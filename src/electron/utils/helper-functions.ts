export function CHECK_ABORT(abortController: AbortController) {
  if (abortController.signal.aborted) {
    throw new Error("User aborted");
  }
}
