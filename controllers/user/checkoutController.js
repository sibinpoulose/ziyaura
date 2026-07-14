import Cart from "../../models/Cart.js";
import Order from"../../models/order.js";
import Product from "../../models/product.js"
import Address from "../../models/address.js";



export const loadCheckoutPage= async (req,res)=>{
    console.log("loaded the loadCheckoutpage controller")
    try{
        const cart=await Cart.findOne({
            userId: req.user._id
        }).populate({
            path: "items.productId",
            populate:({
                path: "category"
            })
            
        })
        if(!cart||cart.items.length===0){
            req.session.error="Your shopping bag is empty";
            return res.redirect("/cart")
        }
        const addresses= await Address.find({
            userId: req.user._id
        })
        const defaultAddress=addresses.find(
            address=>address.isDefault
        )
        const checkoutItems=[];
        let subtotal=0;
        for(let item of cart.items){
            const product=item.productId;
            if(!product||product.isDeleted||!product.isListed||!product.category||!product.category.isListed){
                continue;
            }
            let price=product.salePrice??product.price;
            let image=product.images[0];
            let variantDetails=""
            if(item.variantId){
            let variant=product.variants.id(item.variantId)
                 if(!variant||!variant.isListed){
                continue;
            }
            price=variant.salePrice??variant.price;
            variantDetails=variant.combination.map((n)=>{
                return `${n.name}:${n.value}`
            }).join("|")
            }
            const itemTotal=price*item.quantity
            subtotal=subtotal+itemTotal
            checkoutItems.push({
                productId:product._id,
                variantId:item.variantId || null,
                name:product.name,
                slug:product.slug,
                brand:product.brand,
                image,
                quantity:item.quantity,
                price,
                itemTotal,
                variantDetails
            });
        }
        const shippingCharge=subtotal>50000||subtotal===0?0:500
        const discount=0;
        const grandTotal=subtotal+shippingCharge-discount;
        res.render("user/checkout",{
            checkoutItems,
            addresses,
            defaultAddress,
            subtotal,
            shippingCharge,
            discount,
            grandTotal
        })
        

    }
    catch(error){
        console.log(error);
        req.session.error="unable to load checkout";
        res.redirect("/cart")
    }
}
export const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    if (!addressId) {
      req.session.error = "Please select a shipping address.";
      return res.redirect("/checkout");
    }

    const cart = await Cart.findOne({ userId: req.user._id }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      req.session.error = "Your shopping bag is empty.";
      return res.redirect("/cart");
    }

    const addressDoc = await Address.findOne({ _id: addressId, userId: req.user._id });
    if (!addressDoc) {
      req.session.error = "Invalid shipping address selected.";
      return res.redirect("/checkout");
    }

    const orderProducts = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const prod = item.productId;
      if (!prod || prod.isDeleted || !prod.isListed) {
        req.session.error = `Product "${prod?.name || 'Unknown'}" is no longer available.`;
        return res.redirect("/cart");
      }

      let price = prod.salePrice ?? prod.price;
      let sku = prod.sku;
      let variantDetails = "";
      let targetStock = prod.stock;

      // Handle Variant stock validation
      if (item.variantId) {
        const variant = prod.variants.id(item.variantId);
        if (!variant || !variant.isListed) {
          req.session.error = `Selected option for "${prod.name}" is no longer available.`;
          return res.redirect("/cart");
        }
        price = variant.salePrice ?? variant.price;
        sku = variant.sku;
        targetStock = variant.stock;
        variantDetails = variant.combination.map(c => `${c.name}: ${c.value}`).join(" | ");
      }

      if (targetStock < item.quantity) {
        req.session.error = `Insufficient stock for "${prod.name}". Only ${targetStock} left.`;
        return res.redirect("/cart");
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderProducts.push({
        productId: prod._id,
        variantId: item.variantId || null,
        name: prod.name,
        image: prod.images && prod.images[0] ? prod.images[0] : "/images/placeholder.jpg",
        sku,
        variantDetails,
        price,
        quantity: item.quantity,
        total: itemTotal,
        orderStatus: "Pending"
      });
    }

    const shippingCharge = subtotal > 50000 ? 0 : 500;
    const discount = 0;
    const grandTotal = subtotal + shippingCharge - discount;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ORD-${dateStr}-${randomSuffix}`;

    // Decrement stock
    for (const item of cart.items) {
      const prod = await Product.findById(item.productId._id);
      if (item.variantId) {
        const v = prod.variants.id(item.variantId);
        v.stock -= item.quantity;
      } else {
        prod.stock -= item.quantity;
      }
      await prod.save();
    }

    const newOrder = await Order.create({
      orderId,
      userId: req.user._id,
      shippingAddress: {
        addressId: addressDoc._id,
        fullName: addressDoc.fullName,
        address: addressDoc.address,
        phone: addressDoc.phone,
        landmark: addressDoc.landmark || "",
        city: addressDoc.city,
        state: addressDoc.state,
        pincode: addressDoc.pincode,
        addressType: addressDoc.addressType
      },
      products: orderProducts,
      subtotal,
      shippingCharge,
      discount,
      grandTotal,
      paymentMethod: paymentMethod || "COD",
      paymentStatus: "Pending",
      orderStatus: "Pending"
    });

    cart.items = [];
    await cart.save();

    res.redirect(`/order-success/${newOrder._id}`);
  } catch (error) {
    console.error("Place Order Error:", error);
    req.session.error = "Failed to process your order. Please try again.";
    res.redirect("/checkout");
  }
};

export const loadOrderSuccessPage = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/home");
    }
    res.render("user/order-success", { order });
  } catch (error) {
    console.error("Load Order Success Page Error:", error);
    res.redirect("/home");
  }
};