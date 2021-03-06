import $$observable from './utils/symbol-observable'

import {
  Store,
  PreloadedState,
  StoreEnhancer,
  Dispatch,
  Observer,
  ExtendState
} from './types/store'
import { Action } from './types/actions'
// Reducer 函数类型，参数为state，action,
// export type Reducer<S = any, A extends Action = AnyAction> = (
//   state: S | undefined,
//   action: A
// ) => S
import { Reducer } from './types/reducers'
import ActionTypes from './utils/actionTypes'
import isPlainObject from './utils/isPlainObject'


/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param preloadedState The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
// 函数重载
// 函数重载一，参数为reducer、可选enchancer-增强器和一些中间件
// 函数重载二，reducer，preloadedState-state初始值
// 函数重载三，reducer,preloadedState_state初始值或storeEnchancer增强器，storeEnchancer增强器
export default function createStore<
  S,
  A extends Action,
  Ext = {},
  StateExt = never
>(
  reducer: Reducer<S, A>,
  enhancer?: StoreEnhancer<Ext, StateExt>
): Store<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext
export default function createStore<
  S,
  A extends Action,
  Ext = {},
  StateExt = never
>(
  reducer: Reducer<S, A>,
  preloadedState?: PreloadedState<S>,
  enhancer?: StoreEnhancer<Ext, StateExt>
): Store<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext
export default function createStore<
  S,
  A extends Action,
  Ext = {},
  StateExt = never
>(
  reducer: Reducer<S, A>,
  preloadedState?: PreloadedState<S> | StoreEnhancer<Ext, StateExt>,
  enhancer?: StoreEnhancer<Ext, StateExt>
): Store<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext {
  // 根据参数类型做判断，不支持多个增强器在多个函数中
  // 重载函数三中preloadedState  StoreEnhancer 且enhancer StoreEnhancer不支持
  if (
    (typeof preloadedState === 'function' && typeof enhancer === 'function') ||
    (typeof enhancer === 'function' && typeof arguments[3] === 'function')
  ) {
    throw new Error(
      'It looks like you are passing several store enhancers to ' +
        'createStore(). This is not supported. Instead, compose them ' +
        'together to a single function.'
    )
  }
  
  // 重载函数三，preloadedState为function，将其转为enhancer
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState as StoreEnhancer<Ext, StateExt>
    preloadedState = undefined
  }

  // 增强器必须是函数，否则报错
  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }
    // as类型断言，与<类型>值写法相等
    // & | 属于交叉类型，联合类型A|B表示一个类型为A或B的类型， A&B表示同时为A且B类型
    // 执行增强器,将createStore传入，再在返回值函数中传入reducer,preloadedState。通过高阶函数实现重新调用
    // createStore(reducer,preloadedState)实现增强作用
    return enhancer(createStore)(reducer, preloadedState as PreloadedState<
      S
    >) as Store<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext
  }


  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.')
  }
  // 当前reducer
  let currentReducer = reducer
  // as 类型断言 当前state
  let currentState = preloadedState as S
  // [function, function,function]
  // 监听队列
  let currentListeners: (() => void)[] | null = []
  // 浅拷贝
  let nextListeners = currentListeners
  // 是否正在dispatching
  let isDispatching = false

  /**
   * This makes a shallow copy of currentListeners so we can use
   * nextListeners as a temporary list while dispatching.
   *
   * This prevents any bugs around consumers calling
   * subscribe/unsubscribe in the middle of a dispatch.
   */
  function ensureCanMutateNextListeners() {
    // currentListeners 与 nextListeners同引用的话，“深拷贝”一份出来
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns The current state tree of your application.
   */
  // 获取当前state currentState
  function getState(): S {
    // 正在dispatch的操作不可以getState,
    // 因为dispatch操作是用来修改state的，这样可以保证获取到最新state
    if (isDispatching) {
      throw new Error(
        'You may not call store.getState() while the reducer is executing. ' +
          'The reducer has already received the state as an argument. ' +
          'Pass it down from the top reducer instead of reading it from the store.'
      )
    }

    return currentState as S
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param listener A callback to be invoked on every dispatch.
   * @returns A function to remove this change listener.
   */
  
   // dispath事件监听函数，触发一次，执行一次
  function subscribe(listener: () => void) {
    // listener必须是函数类型
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function.')
    }
    // 不可以在修改state时，调用subscribe，保证state只可同时被一个reducer更改
    if (isDispatching) {
      throw new Error(
        'You may not call store.subscribe() while the reducer is executing. ' +
          'If you would like to be notified after the store has been updated, subscribe from a ' +
          'component and invoke store.getState() in the callback to access the latest state. ' +
          'See https://redux.js.org/api-reference/store#subscribelistener for more details.'
      )
    }
    // 标志是否被订阅
    let isSubscribed = true
    // 拷贝currentListener to nextListener
    ensureCanMutateNextListeners()
    // 添加一个订阅函数
    nextListeners.push(listener)
    
    // 返回取消订阅函数
    return function unsubscribe() {
      // 保证必须是已订阅才可以被取消订阅
      if (!isSubscribed) {
        return
      }
      // 同上
      if (isDispatching) {
        throw new Error(
          'You may not unsubscribe from a store listener while the reducer is executing. ' +
            'See https://redux.js.org/api-reference/store#subscribelistener for more details.'
        )
      }

      isSubscribed = false
      ensureCanMutateNextListeners()
      // 取消订阅，即删除订阅的listener
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
      // 为什么要把currentListeners置null呢？？? 内存释放？目前没有看到currentListeners的用途
      currentListeners = null
    }
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  // 触发state变更函数
  function dispatch(action: A) {
    // 参数类型判断，必须为object,通过getPrototypeOf判断
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
          'Use custom middleware for async actions.'
      )
    }
    // 类型判断，type为必传属性
    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          'Have you misspelled a constant?'
      )
    }
    // 不可以同时执行两个dispatch来修改state，保证state唯一
    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      // 执行reducer,修改state值，返回修改后的state
      isDispatching = true
      currentState = currentReducer(currentState, action)
    } finally {
      // 标记完成dispatch
      isDispatching = false
    }
    //执行所有监听函数，主要用于渲染数据变更
    const listeners = (currentListeners = nextListeners)
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }
    // 返回传入的action
    return action
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param nextReducer The reducer for the store to use instead.
   * @returns The same store instance with a new reducer in place.
   */

   // 替换reducer，不常用，在react-redux的热加载机制里面用到了
  function replaceReducer<NewState, NewActions extends A>(
    nextReducer: Reducer<NewState, NewActions>
  ): Store<ExtendState<NewState, StateExt>, NewActions, StateExt, Ext> & Ext {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    // TODO: do this more elegantly
    // currentReucer = nexReducer 替换reducer
    ;((currentReducer as unknown) as Reducer<
      NewState,
      NewActions
    >) = nextReducer

    // This action has a similar effect to ActionTypes.INIT.
    // Any reducers that existed in both the new and old rootReducer
    // will receive the previous state. This effectively populates
    // the new state tree with any relevant data from the old one.
    // 采用新的reducer初始化state值
    // ActionTypes.REPLACE标记replace 替换reducer操作
    dispatch({ type: ActionTypes.REPLACE } as A)
    // change the type of the store by casting it to the new store
    // 返回store
    return (store as unknown) as Store<
      ExtendState<NewState, StateExt>,
      NewActions,
      StateExt,
      Ext
    > &
      Ext
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  // 应该主要是用于修改state，目前应该只redux-observable使用了，待确定
  function observable() {
    const outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer: unknown) {
        if (typeof observer !== 'object' || observer === null) {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          const observerAsObserver = observer as Observer<S>
          if (observerAsObserver.next) {
            observerAsObserver.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT } as A)

  const store = ({
    dispatch: dispatch as Dispatch<A>,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  } as unknown) as Store<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext
  return store
}
