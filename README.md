# Tiny Slice

A lightweight state management library for React.

The library internally uses React's `useReducer` which works standalone without a store.

This is not a replacement for Redux. It's a lightweight alternative for simple state management action/reducer.

## Install
```bash
npm install tiny-slice
# or
yarn add tiny-slice
```

## Features

- Lightweight
- TypeScript support
- Async action handling (like Redux Thunks)
- Zero dependencies
- Debug mode

## ExampleUsage

```ts
import { createTinySlice, createAsyncAction, useTinySlice } from 'tiny-slice'

type CounterState = {
  value: number
  loading: boolean
}

const initialState: CounterState = {
  value: 0,
  loading: false,
}

const counterSlice = createTinySlice<CounterState>({
  initialState,
  actions: {
    increment: (state) => {
      state.value += 1
    },
    decrement: (state) => {
      state.value -= 1
    },
    incrementAsync: createAsyncAction(async (state) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      state.value += 1
    }, {
      onPending: (state) => {
        state.loading = true
      },
      onSuccess: (state) => {
        state.loading = false
      },
    }),
    decrementAsync: createAsyncAction(async (state) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      state.value -= 1
    }, {
      onPending: (state) => {
        state.loading = true
      },
      onSuccess: (state) => {
        state.loading = false
      },
  },
})

const App = () => {
  const [state, actions] = useTinySlice(counterSlice)

  return (
    <div>
      <p>{state.value} {state.loading ? 'Loading...' : ''}</p>
      <button onClick={() => actions.increment()}>Increment</button>
      <button onClick={() => actions.decrement()}>Decrement</button>
      <button onClick={() => actions.incrementAsync()}>Increment Async</button>
      <button onClick={() => actions.decrementAsync()}>Decrement Async</button>
    </div>
  )
}
```

## API

### createTinySlice

Creates a tiny slice.

```ts
const slice = createTinySlice<State, Actions>({
  initialState,
  actions,
})
```

### createAsyncAction

Creates an async action. Like in Redux Thunks, the async action will trigger the pending, success and error cases.

```ts
const asyncAction = createAsyncAction(async (payload, { getState, dispatch }) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  let value = getState().value
  if (payload.type === 'increment') {
    value += 1
  } else if (payload.type === 'decrement') {
    value -= 1
  }
  return { value }
}, {
  onPending: (state) => {
    state.loading = true
  },
  onSuccess: (state) => {
    state.loading = false
  },
  onError: (state, error) => {
    state.loading = false
    state.error = error
  },
})
```

### useTinySlice

A hook to use the slice state and dispatch actions.

```ts
const [state, actions] = useTinySlice(slice)

return (
  <div>
    <p>{state.value}</p>
    <button onClick={() => actions.increment()}>Increment</button>
  </div>
)
```


