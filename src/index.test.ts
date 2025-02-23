import { createTinySlice, createAsyncAction } from './index';
import { renderHook, act } from '@testing-library/react';
import { useTinySlice } from './index';

interface TestState {
  count: number;
  loading: boolean;
  error: string | null;
}

describe('TinySlice', () => {
  // Test slice creation
  describe('createTinySlice', () => {
    it('should create a slice with initial state', () => {
      const slice = createTinySlice({
        initialState: { count: 0, loading: false, error: null },
        actions: {},
      });

      expect(slice.initialState).toEqual({ count: 0, loading: false, error: null });
    });
  });

  // Test synchronous actions
  describe('sync actions', () => {
    const slice = createTinySlice({
      initialState: { count: 0, loading: false, error: null } as TestState,
      actions: {
        increment: (state, payload: number = 1) => {
          state.count += payload;
        },
        reset: (state) => {
          state.count = 0;
        },
      },
    });

    it('should handle sync actions correctly', () => {
      const { result } = renderHook(() => useTinySlice(slice));

      act(() => {
        result.current[1].increment(5);
      });

      expect(result.current[0].count).toBe(5);

      act(() => {
        result.current[1].reset();
      });

      expect(result.current[0].count).toBe(0);
    });
  });

  // Test async actions
  describe('async actions', () => {
    const mockAsyncIncrement = jest.fn();
    const slice = createTinySlice({
      initialState: { count: 0, loading: false, error: null } as TestState,
      actions: {
        asyncIncrement: createAsyncAction<number, number, TestState>(
          async (payload: number) => {
            mockAsyncIncrement(payload);
            return payload;
          },
          {
            onPending: (state) => {
              state.loading = true;
            },
            onSuccess: (state, payload) => {
              state.count += payload;
              state.loading = false;
            },
            onError: (state, { error }) => {
              state.error = error.message;
              state.loading = false;
            },
          }
        ),
      },
    });

    it('should handle async actions lifecycle', async () => {
      const { result } = renderHook(() => useTinySlice(slice));

      await act(async () => {
        const asyncAction = result.current[1].asyncIncrement(5);
        await asyncAction;
      });

      expect(result.current[0].loading).toBe(false);
      expect(result.current[0].count).toBe(5);
      expect(mockAsyncIncrement).toHaveBeenCalledWith(5);
    });

    it('should handle async action errors', async () => {
      const errorSlice = createTinySlice({
        initialState: { count: 0, loading: false, error: null } as TestState,
        actions: {
          failingAction: createAsyncAction<void, void, TestState>(
            async () => {
              throw new Error('Test error');
            },
            {
              onPending: (state) => {
                state.loading = true;
              },
              onError: (state, { error }) => {
                state.error = error.message;
                state.loading = false;
              },
            }
          ),
        },
      });

      const { result } = renderHook(() => useTinySlice(errorSlice));

      await act(async () => {
        try {
          await result.current[1].failingAction();
        } catch (e) {
          // Expected error
        }
      });

      expect(result.current[0].loading).toBe(false);
      expect(result.current[0].error).toBe('Test error');
    });
  });
});
