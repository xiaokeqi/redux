/**
 * @param obj The object to inspect.
 * @returns True if the argument appears to be a plain object.
 */
// 判断是否为一个普通对象,通过获取对象原型来判断
export default function isPlainObject(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false

  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }

  return Object.getPrototypeOf(obj) === proto
}
