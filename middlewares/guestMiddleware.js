export const isGuest = (req, res, next) => {
  // USER LOGGED IN

  if (req.cookies.userToken) {
    return res.redirect("/home");
  }

  // ADMIN LOGGED IN

  if (req.cookies.adminToken) {
    return res.redirect("/admin/dashboard");
  }

  next();
};
