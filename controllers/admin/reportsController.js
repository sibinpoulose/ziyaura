import {
  getSalesReportData,
  generateExcelReportBuffer,
  streamPdfReport
} from "../../services/admin/reportService.js";

export const loadSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, filterType, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    let start = startDate;
    let end = endDate;

    const today = new Date();
    if (filterType === "daily") {
      start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    } else if (filterType === "weekly") {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      start = new Date(lastWeek.setHours(0, 0, 0, 0)).toISOString();
      end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    } else if (filterType === "yearly") {
      start = new Date(today.getFullYear(), 0, 1).toISOString();
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    }

    const reportData = await getSalesReportData(start, end, page, limit, search || "");
    res.render("admin/sales-report", {
      ...reportData,
      startDate: start ? start.substring(0, 10) : "",
      endDate: end ? end.substring(0, 10) : "",
      filterType: filterType || "",
      search: search || ""
    });
  } catch (error) {
    console.error("Load Sales Report Error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const downloadExcelReport = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;
    const { orders } = await getSalesReportData(startDate, endDate, null, null, search || "");

    const buffer = generateExcelReportBuffer(orders);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Sales-Report-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Download Excel Report Error:", error);
    res.redirect("/admin/sales-report");
  }
};

export const downloadPDFReport = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;
    const reportData = await getSalesReportData(startDate, endDate, null, null, search || "");

    streamPdfReport(res, {
      ...reportData,
      startDate,
      endDate
    });
  } catch (error) {
    console.error("Download PDF Report Error:", error);
    res.redirect("/admin/sales-report");
  }
};
