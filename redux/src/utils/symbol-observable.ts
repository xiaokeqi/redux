// 立即执行函数，$$observable值为(Symbol as any).observable || '@@observable'
const $$observable = /* #__PURE__ */ (() =>
  (typeof Symbol === 'function' && (Symbol as any).observable) ||
  '@@observable')()

export default $$observable
