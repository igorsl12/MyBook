// Envolve handlers async para encaminhar rejeições ao error middleware do Express.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
