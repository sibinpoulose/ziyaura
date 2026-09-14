import Order from "../../models/order.js";

export const getDashboardData = async ({ startDate, endDate, filterType }) => {
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
  const selectedFilter = filterType || "";

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

  let groupFormat = "%Y-%m";
  if (
    filterType === "daily" ||
    filterType === "weekly" ||
    (start && end && end - start <= 31 * 24 * 60 * 60 * 1000)
  ) {
    groupFormat = "%Y-%m-%d";
  }

  const [
    totalOrdersCount,
    successfulOrders,
    timeSeriesStats,
    monthlyStats,
    bestSellingProducts,
    bestSellingCategories,
    bestSellingBrands
  ] = await Promise.all([
    Order.countDocuments({ ...dateMatch }),
    Order.find(successfulOrdersMatch).lean(),
    Order.aggregate([
      { $match: successfulOrdersMatch },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          revenue: { $sum: "$grandTotal" },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          revenue: { $sum: "$grandTotal" },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    Order.aggregate([
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
    ]),
    Order.aggregate([
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
    ]),
    Order.aggregate([
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
    ])
  ]);

  let totalRevenue = 0;
  let totalDiscount = 0;
  successfulOrders.forEach((o) => {
    totalRevenue += o.grandTotal || 0;
    totalDiscount += o.discount || 0;
  });

  const chartLabels = timeSeriesStats.map((s) => s._id);
  const chartData = timeSeriesStats.map((s) => s.revenue);

  return {
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
    selectedFilter,
    startDate: startDate || "",
    endDate: endDate || ""
  };
};
