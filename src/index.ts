import { useCallback, useReducer, useRef } from 'react'

// Types
export type ActionPayload<T> = T

type ActionReducer<State, Payload> = (state: State, payload: Payload) => void

type ThunkAction<Result = void> = {
  type: string
  payload: any
  async: true
  thunk: (dispatch: ThunkDispatch, getState: () => any) => Promise<Result>
}

type Action = {
  type: string
  payload: any
  async?: false
}

// Add ThunkDispatch type
type ThunkDispatch = <T = void>(action: Action | ThunkAction<T>) => Promise<T>

type AsyncActionHelpers<State> = {
  getState: () => State
  dispatch: ThunkDispatch
}

type AsyncActionReducer<State, Payload, Result> = {
  action: (payload: Payload, helpers: AsyncActionHelpers<State>) => Promise<Result>
  onSuccess?: (state: State, payload: Result) => void
  onPending?: (state: State) => void
  onError?: (state: State, payload: { error: Error }) => void
}

type ActionReducers<State> = Record<string, ActionReducer<State, any> | AsyncActionReducer<State, any, any>>

interface SliceOptions<State, AR extends ActionReducers<State>> {
  initialState: State
  actions: AR
  debug?: boolean
}

type ActionCreator<T> =
  T extends ActionReducer<any, infer P>
    ? (payload?: P) => Action
    : T extends AsyncActionReducer<any, infer P, infer R>
      ? (payload?: P) => ThunkAction<R>
      : never

type SliceActions<AR extends ActionReducers<any>> = {
  [K in keyof AR]: ActionCreator<AR[K]>
}

// Helper function to create async actions
export function createAsyncAction<Payload, Result, State>(
  action: (payload: Payload, helpers: AsyncActionHelpers<State>) => Promise<Result>,
  handlers: {
    onSuccess?: (state: State, payload: Result) => void
    onPending?: (state: State) => void
    onError?: (state: State, payload: { error: Error }) => void
  },
): AsyncActionReducer<State, Payload, Result> {
  return {
    action,
    ...handlers,
  }
}

// Create a tiny slice
export function createTinySlice<State, AR extends ActionReducers<State>>(options: SliceOptions<State, AR>) {
  function reducer(state: State, action: { type: string; payload: any }) {
    const [actionType, status] = action.type.split('/')
    const actionReducer = options.actions[actionType]

    if (options.debug) {
      console.group(`Action: ${action.type}`)
      console.log('Payload:', JSON.stringify(action.payload, null, 2))
      console.log('Previous State:', JSON.stringify(state, null, 2))
    }

    let newState = state
    if (actionReducer && 'action' in actionReducer) {
      // Handle async action states
      switch (status) {
        case 'pending':
          if (actionReducer.onPending) {
            newState = { ...state }
            actionReducer.onPending(newState)
          }
          break
        case 'fulfilled':
          if (actionReducer.onSuccess) {
            newState = { ...state }
            actionReducer.onSuccess(newState, action.payload)
          }
          break
        case 'rejected':
          if (actionReducer.onError) {
            newState = { ...state }
            actionReducer.onError(newState, action.payload)
          }
          break
      }
    } else if (actionReducer) {
      // Handle sync action
      newState = { ...state }
      actionReducer(newState, action.payload)
    }

    if (options.debug) {
      console.log('Next State:', JSON.stringify(newState, null, 2))
      console.groupEnd()
    }

    return newState
  }

  // Create action creators that work both in and out of hooks
  const actions = {} as SliceActions<AR>
  for (const actionKey of Object.keys(options.actions)) {
    const actionReducer = options.actions[actionKey]
    if ('action' in actionReducer) {
      actions[actionKey as keyof AR] = ((payload: any) => ({
        type: actionKey,
        payload,
        async: true,
        thunk: async (dispatch: ThunkDispatch, getState: () => State) => {
          try {
            if (options.debug) {
              console.group(`Async Action Started: ${actionKey}`)
              console.log('Payload:', JSON.stringify(payload, null, 2))
              console.log('Current State:', JSON.stringify(getState(), null, 2))
            }

            if (actionReducer.onPending) {
              dispatch({
                type: `${actionKey}/pending`,
                payload: null,
              })
            }

            const result = await actionReducer.action(payload, {
              getState,
              dispatch,
            })

            if (actionReducer.onSuccess) {
              dispatch({
                type: `${actionKey}/fulfilled`,
                payload: result,
              })
            }

            if (options.debug) {
              console.log('Action Result:', JSON.stringify(result, null, 2))
              console.groupEnd()
            }

            return result
          } catch (error) {
            if (options.debug) {
              console.log('Action Error:', error)
              console.groupEnd()
            }

            if (actionReducer.onError) {
              dispatch({
                type: `${actionKey}/rejected`,
                payload: { error: error as Error },
              })
            }
            throw error
          }
        },
      })) as any
    } else {
      actions[actionKey as keyof AR] = ((payload: any) => ({
        type: actionKey,
        payload,
        async: false,
      })) as any
    }
  }

  return {
    initialState: options.initialState,
    reducer,
    reducers: options.actions,
    actions,
  } as const
}

// Hook to use the tiny slice
export function useTinySlice<State, AR extends ActionReducers<State>>(slice: ReturnType<typeof createTinySlice<State, AR>>) {
  const [state, dispatch] = useReducer(slice.reducer, slice.initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const actionsRef = useCallback(() => {
    const actions = {} as SliceActions<AR>
    const getState = () => stateRef.current

    const enhancedDispatch: ThunkDispatch = async <T>(action: Action | ThunkAction<T>) => {
      if (action.async === true && 'thunk' in action) {
        return action.thunk(enhancedDispatch, getState)
      }

      dispatch(action)
      return Promise.resolve() as Promise<T>
    }

    for (const actionKey of Object.keys(slice.reducers)) {
      const actionReducer = slice.reducers[actionKey]

      if ('action' in actionReducer) {
        // Handle async action
        actions[actionKey as keyof AR] = (async (payload: any) => {
          return enhancedDispatch(slice.actions[actionKey](payload))
        }) as any
      } else {
        // Handle sync action
        actions[actionKey as keyof AR] = ((payload: any) => {
          return enhancedDispatch(slice.actions[actionKey](payload))
        }) as any
      }
    }

    return actions
  }, [slice])

  return [state, actionsRef()] as const
}
