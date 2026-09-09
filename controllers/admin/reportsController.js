import Order from "../../models/order.js";
import PDFDocument from "pdfkit";
import XLSX from "xlsx";

// Fetch sales report data helper
const getSalesReportData = async (startDate, endDate) => {
  const query = {
    orderStatus: { $ne: "Cancelled" }
  };

  if (startDate && endDate) {
    let startObj = new Date(startDate);
    let endObj = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime())) {
      if (startObj > endObj) {
        // Swap if start is after end
        const temp = startObj;
        startObj = new Date(endDate);
        endObj = new Date(new Date(temp).setHours(23, 59, 59, 999));
      }

      query.createdAt = {
        $gte: startObj,
        $lte: endObj
      };
    }
  }

  const orders = await Order.find(query).populate("userId", "name email").sort({createdAt:-1});
  
  let overallSalesCount = orders.length;
  let overallOrderAmount = 0;
  let overallDiscount = 0;
  
  orders.forEach(order => {
    overallOrderAmount += order.grandTotal || 0;
    overallDiscount += order.discount || 0;
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
      "Customer Name": o.shippingAddress?.fullName || "",
      "Subtotal (INR)": o.subtotal,
      "Discount Applied (INR)": o.discount,
      "Shipping Charge (INR)": o.shippingCharge,
      "Net Amount (INR)": o.grandTotal,
      "Payment Method": o.paymentMethod || "COD",
      "Payment Status": o.paymentStatus || "Paid",
      "Date": o.createdAt ? o.createdAt.toISOString().slice(0, 10) : ""
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

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Sales-Report-${Date.now()}.pdf`);
    doc.pipe(res);

    // Title & Info
    doc.fontSize(18).font("Helvetica-Bold").text("ZIYAURA SALES LEDGER BOOK REPORT", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").text(`Generated On: ${new Date().toLocaleString()}`);
    doc.text(`Report Period: ${startDate || "All Time"} to ${endDate || "All Time"}`);
    doc.moveDown();

    // Summary block
    doc.fontSize(11).font("Helvetica-Bold").text("Summary Statement:", { underline: true });
    doc.fontSize(9).font("Helvetica");
    doc.text(`Total Successful Sales count: ${overallSalesCount}`);
    doc.text(`Total Amount Collected: INR ${overallOrderAmount.toLocaleString()}`);
    doc.text(`Total Deductions / Discounts: INR ${overallDiscount.toLocaleString()}`);
    doc.moveDown();

    // Table Header
    let currentY = doc.y;
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Order ID", 40, currentY, { width: 105, align: "left" });
    doc.text("Date", 145, currentY, { width: 65, align: "left" });
    doc.text("Payment Method", 210, currentY, { width: 85, align: "center" });
    doc.text("Subtotal", 295, currentY, { width: 60, align: "right" });
    doc.text("Discount", 355, currentY, { width: 55, align: "right" });
    doc.text("Total Paid", 410, currentY, { width: 65, align: "right" });
    doc.text("Status", 475, currentY, { width: 65, align: "center" });

    currentY += 18;
    doc.strokeColor("#cccccc").lineWidth(1).moveTo(40, currentY).lineTo(540, currentY).stroke();
    currentY += 8;

    // Table Rows
    orders.forEach(o => {
      if (currentY > 720) {
        doc.addPage();
        currentY = 40;

        // Re-draw Header on new page
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("Order ID", 40, currentY, { width: 105, align: "left" });
        doc.text("Date", 145, currentY, { width: 65, align: "left" });
        doc.text("Payment Method", 210, currentY, { width: 85, align: "center" });
        doc.text("Subtotal", 295, currentY, { width: 60, align: "right" });
        doc.text("Discount", 355, currentY, { width: 55, align: "right" });
        doc.text("Total Paid", 410, currentY, { width: 65, align: "right" });
        doc.text("Status", 475, currentY, { width: 65, align: "center" });

        currentY += 18;
        doc.strokeColor("#cccccc").lineWidth(1).moveTo(40, currentY).lineTo(540, currentY).stroke();
        currentY += 8;
      }

      doc.fontSize(8).font("Helvetica");
      doc.text(o.orderId, 40, currentY, { width: 105, align: "left" });
      doc.text(o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "", 145, currentY, { width: 65, align: "left" });
      doc.text(o.paymentMethod || "COD", 210, currentY, { width: 85, align: "center" });
      doc.text(`INR ${o.subtotal.toLocaleString()}`, 295, currentY, { width: 60, align: "right" });
      doc.text(`INR ${o.discount.toLocaleString()}`, 355, currentY, { width: 55, align: "right" });
      doc.text(`INR ${o.grandTotal.toLocaleString()}`, 410, currentY, { width: 65, align: "right" });
      doc.text(o.paymentStatus || "Paid", 475, currentY, { width: 65, align: "center" });

      currentY += 18;
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.redirect("/admin/sales-report");
  }
};
