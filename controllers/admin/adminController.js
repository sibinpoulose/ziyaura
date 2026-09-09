import { loginUser } from "../../services/user/authService.js";
import User from "../../models/User.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";


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
        isBlocked: 1
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
export const loadAdminLoginPage = (req, res) => {
  res.render("admin/login");
};

export const loadAdminDashboard = async (req, res) => {
  try {
    const { startDate, endDate, filterType } = req.query;

    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null;

    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (start > end) {
        const temp = start;
        start = new Date(endDate);
        end = new Date(new Date(temp).setHours(23, 59, 59, 999));
      }
    }

    const today = new Date();
    let selectedFilter = filterType || "";

    if (filterType === "daily") {
      start = new Date(today.setHours(0, 0, 0, 0));
      end = new Date(today.setHours(23, 59, 59, 999));
    } else if (filterType === "weekly") {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 6);
      start = new Date(lastWeek.setHours(0, 0, 0, 0));
      end = new Date(today.setHours(23, 59, 59, 999));
    } else if (filterType === "monthly") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filterType === "yearly") {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const dateMatch = {};
    if (start || end) {
      dateMatch.createdAt = {};
      if (start) dateMatch.createdAt.$gte = start;
      if (end) dateMatch.createdAt.$lte = end;
    }

    const successfulOrdersMatch = { orderStatus: { $ne: "Cancelled" }, ...dateMatch };

    // 1. Calculate overall figures for filtered range
    const totalOrdersCount = await Order.countDocuments({ ...dateMatch });
    const successfulOrders = await Order.find(successfulOrdersMatch);
    
    let totalRevenue = 0;
    let totalDiscount = 0;
    successfulOrders.forEach(o => {
      totalRevenue += o.grandTotal || 0;
      totalDiscount += o.discount || 0;
    });

    // 2. Build time-series data for line graph
    let groupFormat = "%Y-%m";
    let isDailyGroup = false;

    if (filterType === "daily" || filterType === "weekly" || (start && end && (end - start) <= 31 * 24 * 60 * 60 * 1000)) {
      groupFormat = "%Y-%m-%d";
      isDailyGroup = true;
    }

    const timeSeriesStats = await Order.aggregate([
      { $match: successfulOrdersMatch },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          revenue: { $sum: "$grandTotal" },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const chartLabels = timeSeriesStats.map(s => s._id);
    const chartData = timeSeriesStats.map(s => s.revenue);

    // Monthly stats for backward compatibility / fallback
    const monthlyStats = await Order.aggregate([
      { $match: { orderStatus: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          revenue: { $sum: "$grandTotal" },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 3. Top 10 Best Selling Products
    const bestSellingProducts = await Order.aggregate([
      { $match: successfulOrdersMatch },
      { $unwind: "$products" },
      { $match: { "products.orderStatus": { $nin: ["Cancelled", "Returned"] } } },
      {
        $group: {
          _id: "$products.productId",
          productName: { $first: "$products.name" },
          quantitySold: { $sum: "$products.quantity" },
          totalRevenue: { $sum: "$products.total" }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 10 }
    ]);

    // 4. Top 10 Best Selling Categories
    const bestSellingCategories = await Order.aggregate([
      { $match: successfulOrdersMatch },
      { $unwind: "$products" },
      { $match: { "products.orderStatus": { $nin: ["Cancelled", "Returned"] } } },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "prodInfo"
        }
      },
      { $unwind: "$prodInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "prodInfo.category",
          foreignField: "_id",
          as: "catInfo"
        }
      },
      { $unwind: "$catInfo" },
      {
        $group: {
          _id: "$catInfo._id",
          categoryName: { $first: "$catInfo.name" },
          quantitySold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 10 }
    ]);

    // 5. Top 10 Best Selling Brands
    const bestSellingBrands = await Order.aggregate([
      { $match: successfulOrdersMatch },
      { $unwind: "$products" },
      { $match: { "products.orderStatus": { $nin: ["Cancelled", "Returned"] } } },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "prodInfo"
        }
      },
      { $unwind: "$prodInfo" },
      {
        $group: {
          _id: "$prodInfo.brand",
          brandName: { $first: "$prodInfo.brand" },
          quantitySold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 10 }
    ]);

    res.render("admin/dashboard", {
      totalOrdersCount,
      totalRevenue,
      totalDiscount,
      monthlyStats,
      chartLabels,
      chartData,
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands,
      filterType: selectedFilter,
      startDate: startDate || "",
      endDate: endDate || ""
    });
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
      startDate: "",
      endDate: ""
    });
  }
};

// ADMIN LOGOUT

export const adminLogout = (req, res) => {
  res.clearCookie("adminToken");

  req.session.success = "Admin logged out";

  res.redirect("/admin/login");
};
