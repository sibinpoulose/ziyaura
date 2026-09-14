import { loginUser } from "../../services/user/authService.js";
import { getCustomersWithPagination, setUserBlockedStatus } from "../../services/admin/customerService.js";
import { getDashboardData } from "../../services/admin/dashboardService.js";
import { COOKIE_MAX_AGE } from "../../utils/constants.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.session.error = "All fields are required";
      return res.redirect("/admin/login");
    }

    const { user, token } = await loginUser(req.body);

    if (user.role !== "admin") {
      req.session.error = "Unauthorized access";
      return res.redirect("/admin/login");
    }

    res.cookie("adminToken", token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE
    });

    req.session.success = "Admin login successful";
    res.redirect("/admin/dashboard");
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/admin/login");
  }
};

export const loadCustomers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = Number(req.query.page) || 1;

    const { users, currentPage, totalPages } = await getCustomersWithPagination({
      search,
      page,
      limit: 5
    });

    res.render("admin/customers", {
      users,
      currentPage,
      totalPages,
      search
    });
  } catch (err) {
    console.error("Load customers error:", err);
    res.redirect("/admin/dashboard");
  }
};

export const blockUser = async (req, res) => {
  try {
    await setUserBlockedStatus(req.params.id, true);
    res.redirect("/admin/customers");
  } catch (err) {
    console.error("Block user error:", err);
    res.redirect("/admin/customers");
  }
};

export const unblockUser = async (req, res) => {
  try {
    await setUserBlockedStatus(req.params.id, false);
    res.redirect("/admin/customers");
  } catch (err) {
    console.error("Unblock user error:", err);
    res.redirect("/admin/customers");
  }
};

export const loadAdminLoginPage = (req, res) => {
  res.render("admin/login");
};

export const loadAdminDashboard = async (req, res) => {
  try {
    const { startDate, endDate, filterType } = req.query;
    const dashboardData = await getDashboardData({ startDate, endDate, filterType });

    res.render("admin/dashboard", dashboardData);
  } catch (error) {
    console.error("Dashboard calculation error:", error);
    res.render("admin/dashboard", {
      totalOrdersCount: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      monthlyStats: [],
      chartLabels: [],
      chartData: [],
      bestSellingProducts: [],
      bestSellingCategories: [],
      bestSellingBrands: [],
      filterType: "",
      selectedFilter: "",
      startDate: "",
      endDate: ""
    });
  }
};

export const adminLogout = (req, res) => {
  res.clearCookie("adminToken");
  req.session.success = "Admin logged out";
  res.redirect("/admin/login");
};
