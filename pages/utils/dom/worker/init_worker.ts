export function addMessageListener<T>(
  callback: (this: Window, event: MessageEvent<T>) => void,
) {
  self?.addEventListener("message", function (event: MessageEvent<T>) {
    const trustedOrigins = ["", self?.location?.origin];
    if (
      !event ||
      trustedOrigins.every((trustedOrigin) => event.origin === trustedOrigin)
    ) {
      return;
    }
    callback.bind(this)(event);
  });
}

export function initTaskWorker<MessageRequest, MessageResponse>(
  main: (d: MessageRequest) => MessageResponse,
  postReady: boolean = false,
) {
  addMessageListener<MessageRequest>((event) => {
    if (event.data !== null) self.postMessage(main(event.data));
  });
  if (postReady) self?.postMessage(null); // indicate ready
}
