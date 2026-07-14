// For user-facing login / signup / otp pages.
// If a normal user is already logged in, send them home.
export const isUserGuest = (req, res, next) => {
  if (req.user) {
    return res.redirect("/home");
  }
  next();
};

// For admin login page.
// If an admin is already logged in, send them to the dashboard.
export const isAdminGuest = (req, res, next) => {
  if (req.admin) {
    return res.redirect("/admin/dashboard");
  }
  next();
};

// Keep the old name as an alias so nothing else breaks if it is imported elsewhere.
export const isGuest = isUserGuest;

