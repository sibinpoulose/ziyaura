import { loginUser } from "../../services/user/authService.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // EMPTY CHECK

    if (!email || !password) {
      req.session.error = "All fields are required";

      return res.redirect("/admin/login");
    }

    // LOGIN

    const data = await loginUser(req.body);

    // CHECK ADMIN

    if (data.user.role !== "admin") {
      req.session.error = "Unauthorized access";

      return res.redirect("/admin/login");
    }

    // TOKEN COOKIE

    res.cookie(
      "adminToken",

      data.token,

      {
        httpOnly: true,

        maxAge: 24 * 60 * 60 * 1000
      }
    );

    req.session.success = "Admin login successful";

    res.redirect("/admin/dashboard");
  } catch (err) {
    req.session.error = err.message;

    res.redirect("/admin/login");
  }
};
import User from "../../models/User.js";

// LOAD CUSTOMERS

export const loadCustomers = async (req, res) => {
  try {
    // SEARCH

    const search = req.query.search || "";

    // PAGINATION

    const page = Number(req.query.page) || 1;

    const limit = 5;

    const skip = (page - 1) * limit;

    // SEARCH QUERY

    const searchQuery = {
      role: "user",

      $or: [
        {
          name: {
            $regex: search,

            $options: "i"
          }
        },

        {
          email: {
            $regex: search,

            $options: "i"
          }
        }
      ]
    };

    // GET USERS

    const users = await User.find(searchQuery)

      .sort({
        createdAt: -1
      })

      .skip(skip)

      .limit(limit);

    // TOTAL USERS

    const totalUsers = await User.countDocuments(searchQuery);

    // TOTAL PAGES

    const totalPages = Math.ceil(totalUsers / limit);

    // RENDER PAGE

    res.render(
      "admin/customers",

      {
        users,

        currentPage: page,

        totalPages,

        search
      }
    );
  } catch (err) {
    console.log("Load customers error:", err);

    res.redirect("/admin/dashboard");
  }
};
// BLOCK USER

export const blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.params.id,

      {
        isBlocked: true
      }
    );

    res.redirect("/admin/customers");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/customers");
  }
};

// UNBLOCK USER

export const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.params.id,

      {
        isBlocked: false
      }
    );

    res.redirect("/admin/customers");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/customers");
  }
};
export const loadblockeduser = async (req, res) => {
  const blockedusers = User.find({
    isBlocked: true
  });
  res.render("/blockeduser", { blockedusers });
};
// ADMIN LOGOUT

export const adminLogout = (req, res) => {
  res.clearCookie("adminToken");

  req.session.success = "Admin logged out";

  res.redirect("/admin/login");
};
