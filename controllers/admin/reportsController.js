import Order from "../../models/order.js";
import PDFDocument from "pdfkit";
import XLSX from "xlsx";

// Fetch sales report data helper
const getSalesReportData = async (startDate, endDate) => {
  const query = {
    orderStatus: { $ne: "Cancelled" },
    paymentStatus: "Paid"
  };

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
    };
  }

  const orders = await Order.find(query).populate("userId", "name");
  
  let overallSalesCount = orders.length;
  let overallOrderAmount = 0;
  let overallDiscount = 0;
  
  orders.forEach(order => {
    overallOrderAmount += order.grandTotal;
    overallDiscount += order.discount;
  });

  return {
    orders,
    overallSalesCount,
    overallOrderAmount,
    overallDiscount
  };
};

// Render sales report interface
export const loadSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, filterType } = req.query;
    
    let start = startDate;
    let end = endDate;

    // Apply quick presets (daily, weekly, yearly)
    const today = new Date();
    if (filterType === "daily") {
      start = new Date(today.setHours(0,0,0,0)).toISOString();
      end = new Date(today.setHours(23,59,59,999)).toISOString();
    } else if (filterType === "weekly") {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      start = new Date(lastWeek.setHours(0,0,0,0)).toISOString();
      end = new Date(today.setHours(23,59,59,999)).toISOString();
    } else if (filterType === "yearly") {
      start = new Date(today.getFullYear(), 0, 1).toISOString();
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    }

    const reportData = await getSalesReportData(start, end);
    res.render("admin/sales-report", {
      ...reportData,
      startDate: start ? start.substring(0, 10) : "",
      endDate: end ? end.substring(0, 10) : "",
      filterType: filterType || ""
    });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/dashboard");
  }
};

// Download Excel sales ledger spreadsheet
export const downloadExcelReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { orders } = await getSalesReportData(startDate, endDate);

    const rows = orders.map(o => ({
      "Order ID": o.orderId,
      "Customer Name": o.shippingAddress.fullName,
      "Subtotal (INR)": o.subtotal,
      "Discount Applied (INR)": o.discount,
      "Shipping Charge (INR)": o.shippingCharge,
      "Net Amount (INR)": o.grandTotal,
      "Payment Mode": o.paymentMethod,
      "Date": o.createdAt.toISOString().slice(0, 10)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Sales-Report-${new Date().toISOString().slice(0,10)}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.redirect("/admin/sales-report");
  }
};

// Download PDF sales summary report
export const downloadPDFReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { orders, overallSalesCount, overallOrderAmount, overallDiscount } = await getSalesReportData(startDate, endDate);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Sales-Report-${Date.now()}.pdf`);
    doc.pipe(res);

    // Title & Info
    doc.fontSize(20).text("ZIYAURA SALES LEDGER BOOK REPORT", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Generated On: ${new Date().toLocaleString()}`);
    doc.text(`Report Period: ${startDate || "All Time"} to ${endDate || "All Time"}`);
    doc.moveDown();

    // Summary block
    doc.fontSize(12).text("Summary Statement:", { underline: true });
    doc.text(`Total Successful Sales count: ${overallSalesCount}`);
    doc.text(`Total Amount Collected: INR ${overallOrderAmount.toLocaleString()}`);
    doc.text(`Total Deductions / Discounts: INR ${overallDiscount.toLocaleString()}`);
    doc.moveDown(2);

    // Table Header
    doc.fontSize(10).text("Order ID", 50, doc.y, { width: 100 });
    doc.text("Date", 150, doc.y, { width: 80 });
    doc.text("Amount", 230, doc.y, { width: 80 });
    doc.text("Discount", 310, doc.y, { width: 80 });
    doc.text("Total Paid", 390, doc.y, { width: 80 });
    doc.text("Status", 470, doc.y, { width: 80 });
    doc.moveDown();
    doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Table Rows
    orders.forEach(o => {
      doc.text(o.orderId, 50, doc.y, { width: 100 });
      doc.text(o.createdAt.toISOString().slice(0, 10), 150, doc.y, { width: 80 });
      doc.text(`INR ${o.subtotal}`, 230, doc.y, { width: 80 });
      doc.text(`INR ${o.discount}`, 310, doc.y, { width: 80 });
      doc.text(`INR ${o.grandTotal}`, 390, doc.y, { width: 80 });
      doc.text(o.paymentStatus, 470, doc.y, { width: 80 });
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.redirect("/admin/sales-report");
  }
};
