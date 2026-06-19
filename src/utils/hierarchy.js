export function getDescendants(parentId, allKurumlar) {
  if (!parentId || !allKurumlar) return []
  const result = []
  const queue = [parentId]
  const visited = new Set()
  while (queue.length > 0) {
    const currentId = queue.shift()
    if (visited.has(currentId)) continue
    visited.add(currentId)
    const children = allKurumlar.filter(k => k.parentId === currentId)
    children.forEach(child => {
      result.push(child)
      queue.push(child.id)
    })
  }
  return result
}

export function getAncestors(id, allKurumlar) {
  if (!id || !allKurumlar) return []
  const ancestors = []
  let currId = id
  const visited = new Set()
  while (currId) {
    if (visited.has(currId)) break
    visited.add(currId)
    const currObj = allKurumlar.find(k => k.id === currId)
    if (!currObj) break
    const pId = currObj.parentId
    if (pId && pId !== currId) {
      ancestors.push(pId)
      currId = pId
    } else {
      break
    }
  }
  return ancestors
}
