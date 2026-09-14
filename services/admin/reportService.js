import Order from "../../models/order.js";
import PDFDocument from "pdfkit";
import XLSX from "xlsx";

export const getSalesReportData = async (startDate, endDate, page = null, limit = null, search = "") => {
  const query = {
    orderStatus: { $ne: "Cancelled" }
  };

  if (startDate && endDate) {
    let startObj = new Date(startDate);
    let endObj = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime())) {
      if (startObj > endObj) {
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

  if (search) {
    query.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { "shippingAddress.fullName": { $regex: search, $options: "i" } },
      { paymentMethod: { $regex: search, $options: "i" } }
    ];
  }

  const allMatchingOrders = await Order.find(query).lean();
  let overallSalesCount = allMatchingOrders.length;
  let overallOrderAmount = 0;
  let overallDiscount = 0;

  allMatchingOrders.forEach((order) => {
    overallOrderAmount += order.grandTotal || 0;
    overallDiscount += order.discount || 0;
  });

  let ordersQuery = Order.find(query).populate("userId", "name email").sort({ createdAt: -1 });
  if (page && limit) {
    const skip = (page - 1) * limit;
    ordersQuery = ordersQuery.skip(skip).limit(limit);
  }

  const orders = await ordersQuery.lean();
  const totalPages = limit ? Math.ceil(overallSalesCount / limit) || 1 : 1;

  return {
    orders,
    overallSalesCount,
    overallOrderAmount,
    overallDiscount,
    totalPages,
    currentPage: page || 1
  };
};

export const generateExcelReportBuffer = (orders) => {
  const rows = orders.map((o) => ({
    "Order ID": o.orderId,
    "Customer Name": o.shippingAddress?.fullName || "",
    "Subtotal (INR)": o.subtotal,
    "Discount Applied (INR)": o.discount,
    "Shipping Charge (INR)": o.shippingCharge,
    "Net Amount (INR)": o.grandTotal,
    "Payment Method": o.paymentMethod || "COD",
    "Payment Status": o.paymentStatus || "Paid",
    Date: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

export const streamPdfReport = (res, { orders, overallSalesCount, overallOrderAmount, overallDiscount, startDate, endDate }) => {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=Sales-Report-${Date.now()}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).font("Helvetica-Bold").text("ZIYAURA SALES LEDGER BOOK REPORT", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica").text(`Generated On: ${new Date().toLocaleString()}`);
  doc.text(`Report Period: ${startDate || "All Time"} to ${endDate || "All Time"}`);
  doc.moveDown();

  doc.fontSize(11).font("Helvetica-Bold").text("Summary Statement:", { underline: true });
  doc.fontSize(9).font("Helvetica");
  doc.text(`Total Successful Sales count: ${overallSalesCount}`);
  doc.text(`Total Amount Collected: INR ${overallOrderAmount.toLocaleString()}`);
  doc.text(`Total Deductions / Discounts: INR ${overallDiscount.toLocaleString()}`);
  doc.moveDown();

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

  orders.forEach((o) => {
    if (currentY > 720) {
      doc.addPage();
      currentY = 40;

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
    doc.text(o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "", 145, currentY, { width: 65, align: "left" });
    doc.text(o.paymentMethod || "COD", 210, currentY, { width: 85, align: "center" });
    doc.text(`INR ${o.subtotal.toLocaleString()}`, 295, currentY, { width: 60, align: "right" });
    doc.text(`INR ${o.discount.toLocaleString()}`, 355, currentY, { width: 55, align: "right" });
    doc.text(`INR ${o.grandTotal.toLocaleString()}`, 410, currentY, { width: 65, align: "right" });
    doc.text(o.paymentStatus || "Paid", 475, currentY, { width: 65, align: "center" });

    currentY += 18;
  });

  doc.end();
};
