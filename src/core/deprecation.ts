/**
 * Deprecation helper: wraps a function to emit a warning and delegate to a replacement.
 * @param oldName - Name of deprecated function (for warning message)
 * @param newFn - New function to call instead
 * @param since - Version when deprecated (default: 'v0.2.0')
 * @returns Wrapper function that warns and calls newFn
 */
export function deprecated<T extends (...args: any[]) => any>(
  oldName: string,
  newFn: T,
  since: string = 'v0.2.0'
): T {
  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    console.warn(
      `${oldName}() is deprecated since ${since}. Use ${newFn.name}() instead.`
    );
    return newFn.apply(this, args);
  } as T;
}

