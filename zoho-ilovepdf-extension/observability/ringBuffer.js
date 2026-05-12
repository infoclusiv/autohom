const AutohomRingBuffer = (() => {
  const events = [];
  const MAX = 500;

  function add(event) {
    events.push(event);
    if (events.length > MAX) {
      events.splice(0, events.length - MAX);
    }
  }

  function recent(limit = 50) {
    return events.slice(-limit);
  }

  return { add, recent };
})();
