import PDFDocument from "pdfkit";

export const generateInvoicePDF = (order, writeStream) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  // Pipe to response/file stream
  doc.pipe(writeStream);

  // --- HEADER SECTION ---
  doc.fillColor("#111827")
     .fontSize(22)
     .font("Helvetica-Bold")
     .text("ZIYAURA", 50, 50);

  doc.fontSize(8)
     .font("Helvetica")
     .fillColor("#6B7280")
     .text("Modern Luxury Jewelry & Accessories", 50, 75)
     .text("Support Email: support@ziyaura.com", 50, 88)
     .text("Website: www.ziyaura.com", 50, 100);

  // Invoice Meta
  doc.font("Helvetica-Bold")
     .fontSize(12)
     .fillColor("#111827")
     .text("INVOICE", 400, 50, { align: "right" });

  doc.font("Helvetica")
     .fontSize(9)
     .fillColor("#374151")
     .text(`Invoice ID: ${order.orderId}`, 400, 68, { align: "right" })
     .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 400, 82, { align: "right" })
     .text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`, 400, 96, { align: "right" });

  // Divider Line
  doc.moveTo(50, 120).lineTo(545, 120).strokeColor("#E5E7EB").lineWidth(1).stroke();

  // --- ADDRESS SECTION ---
  doc.font("Helvetica-Bold")
     .fontSize(10)
     .fillColor("#111827")
     .text("SHIPPED TO:", 50, 140);

  const addr = order.shippingAddress;
  doc.font("Helvetica")
     .fontSize(9)
     .fillColor("#374151")
     .text(addr.fullName, 50, 155)
     .text(addr.address, 50, 168)
     .text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 50, 181)
     .text(`Phone: ${addr.phone}`, 50, 194);

  // Divider
  doc.moveTo(50, 215).lineTo(545, 215).stroke();

  // --- PRODUCTS TABLE ---
  let currentY = 235;

  // Table Headers
  doc.font("Helvetica-Bold")
     .fontSize(9)
     .fillColor("#111827");
  doc.text("ITEM DESCRIPTION", 50, currentY);
  doc.text("PRICE", 300, currentY, { width: 70, align: "right" });
  doc.text("QTY", 380, currentY, { width: 40, align: "right" });
  doc.text("TOTAL", 465, currentY, { width: 80, align: "right" });

  doc.moveTo(50, currentY + 15).lineTo(545, currentY + 15).strokeColor("#9CA3AF").stroke();

  currentY += 25;

  let grossSubtotal = 0;
  let cancelledTotal = 0;

  // Table Rows
  order.products.forEach(item => {
    grossSubtotal += item.total;
    const isCancelledOrReturned = ["Cancelled", "Returned"].includes(item.orderStatus);
    if (isCancelledOrReturned) {
      cancelledTotal += item.total;
    }

    const statusNote = item.orderStatus !== "Pending" && item.orderStatus !== "Delivered" && item.orderStatus !== "Shipped" && item.orderStatus !== "Out for Delivery" 
      ? ` [${item.orderStatus.toUpperCase()}]` 
      : "";

    doc.font("Helvetica-Bold")
       .fillColor(isCancelledOrReturned ? "#EF4444" : "#111827")
       .text(item.name + statusNote, 50, currentY);

    if (item.variantDetails) {
      doc.font("Helvetica").fontSize(8).fillColor("#6B7280").text(item.variantDetails, 50, currentY + 12);
    }

    doc.font("Helvetica").fontSize(9).fillColor(isCancelledOrReturned ? "#9CA3AF" : "#374151");
    doc.text(`INR ${item.price.toLocaleString()}`, 300, currentY, { width: 70, align: "right" });
    doc.text(item.quantity.toString(), 380, currentY, { width: 40, align: "right" });

    if (isCancelledOrReturned) {
      doc.text(`INR 0`, 465, currentY, { width: 80, align: "right" });
    } else {
      doc.text(`INR ${item.total.toLocaleString()}`, 465, currentY, { width: 80, align: "right" });
    }

    currentY += item.variantDetails ? 32 : 24;
  });

  // Divider
  doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor("#E5E7EB").stroke();
  currentY += 15;

  // --- TOTALS ---
  const drawTotalLine = (label, value, isBold = false, color = "#374151") => {
    doc.font(isBold ? "Helvetica-Bold" : "Helvetica")
       .fontSize(9)
       .fillColor(isBold ? "#111827" : color);
    doc.text(label, 260, currentY, { width: 180, align: "right" });
    doc.text(value, 445, currentY, { width: 100, align: "right" });
    currentY += 18;
  };

  if (cancelledTotal > 0) {
    drawTotalLine("Original Subtotal:", `INR ${grossSubtotal.toLocaleString()}`);
    drawTotalLine("Less Cancelled / Returned:", `- INR ${cancelledTotal.toLocaleString()}`, false, "#EF4444");
  }

  drawTotalLine("Active Subtotal:", `INR ${order.subtotal.toLocaleString()}`);
  drawTotalLine("Shipping Charge:", order.shippingCharge === 0 ? "FREE" : `INR ${order.shippingCharge.toLocaleString()}`);
  if (order.discount > 0) {
    drawTotalLine("Coupon Discount:", `- INR ${order.discount.toLocaleString()}`, false, "#059669");
  }
  
  // Total Line Divider
  doc.moveTo(350, currentY).lineTo(545, currentY).stroke();
  currentY += 8;
  
  drawTotalLine("Net Amount:", `INR ${order.grandTotal.toLocaleString()}`, true);

  // --- FOOTER ---
  doc.fontSize(8)
     .fillColor("#9CA3AF")
     .text("Thank you for shopping with ZIYAURA. This is a computer-generated invoice and does not require signature.", 50, 720, { align: "center", width: 495 });

  doc.end();
};