export const flashMiddleware = (req, res, next) => {

  res.locals.success = req.session.success || null;

  res.locals.error = req.session.error || null;


  // CLEAR AFTER USE

  req.session.success = null;

  req.session.error = null;

  next();

};