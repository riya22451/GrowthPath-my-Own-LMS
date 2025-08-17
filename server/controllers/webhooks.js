import {Webhook} from "svix"
import User from "../models/user.js"
import Stripe from "stripe"
import  {Purchase}  from "../models/Purchase.js"
import Course from "../models/course.js"
export const clerkWebHooks=async(req,res)=>{
  try {
    const whook=new Webhook(process.env.CLERK_WEBHOOK_SECRET)
    await whook.verify(req.body,{
        "svix-id":req.headers['svix-id'],
        "svix-timestamp":req.headers['svix-timestamp'],
        "svix-signature":req.headers['svix-signature']
    })
  const body = JSON.parse(req.body.toString());

console.log("✅ verified");
console.log("type:", body.type);
console.log("data:", body.data);
   switch (body.type) {
      case "user.created": {
        const userData = {
          _id: body.data.id,
          email: body.data.email_addresses[0].email_address,
          name: (body.data.first_name || "") + " " + (body.data.last_name || ""),
          imageUrl: body.data.image_url,
        };
        await User.create(userData);
        console.log("✅ user added to DB");
        return res.status(200).json({ success: true });
      }

      case "user.updated": {
        const userData = {
          email: body.data.email_addresses[0].email_address,
          name: (body.data.first_name || "") + " " + (body.data.last_name || ""),
          imageUrl: body.data.image_url,
        };
        await User.findByIdAndUpdate(body.data.id, userData);
        return res.status(200).json({ success: true });
      }

      case "user.deleted": {
        await User.findByIdAndDelete(body.data.id);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(200).json({ received: true });
    }
  
    
  } catch (error) {
    console.log("❌ webhook error:", error); 
    res.json({success:false,message:error.message})
  }
}
const stripeInstance=new Stripe(process.env.STRIPE_SECRET_KEY)
export const stripeWebhooks = async (request, response) => {
  console.log("✅ Webhook hit");
  const sig = request.headers["stripe-signature"];
  console.log("📩 Stripe signature:", sig);

  let event;
  try {
    event = Stripe.webhooks.constructEvent(
      request.body, // raw buffer required
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("📌 Event type:", event.type);
  } catch (err) {
    console.error("⚠️ Signature verification failed:", err.message);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        console.log("💰 Checkout session completed triggered");
        const paymentIntent = event.data.object;
        

        const paymentIntentId = paymentIntent.id;
        const session=await stripeInstance.checkout.sessions.list({
          payment_intent:paymentIntentId
        })
        const {purchaseId}=session.data[0].metadata
        const purchaseData = await Purchase.findById(purchaseId);
        console.log("📄 Purchase data from DB:", purchaseData);

        if (!purchaseData) {
          console.error("❌ No purchase found for ID:", purchaseId);
          break;
        }

        const userData = await User.findById(purchaseData.userId);
        console.log("👤 User data:", userData);

        const courseData = await Course.findById(purchaseData.courseId.toString());
        console.log("📚 Course data:", courseData);

        if (courseData && userData) {
          courseData.enrolledStudents.push(userData);
          await courseData.save();
          console.log("✅ Course updated");

          userData.enrolledCourses.push(courseData._id);
          await userData.save();
          console.log("✅ User updated");

          purchaseData.status = "completed";
          await purchaseData.save();
          console.log("✅ Purchase status updated to completed");
        }
        break;
      }

      case "payment_intent.payment_failed": {
        console.log("❌ Payment failed");
        const paymentIntent = event.data.object;
        const paymentIntentId=paymentIntent.id

        const sessionList = await stripeInstance.checkout.sessions.list({
          payment_intent: paymentIntentId,
        });
        console.log("Session list:", sessionList.data);

        const {purchaseId} = sessionList.data[0].metadata;
        console.log("🆔 Purchase ID from failed intent:", purchaseId);

        const purchaseData = await Purchase.findById(purchaseId);
        
          purchaseData.status = "failed";
          await purchaseData.save();
          console.log("✅ Purchase status updated to failed");
        
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("🔥 Error during webhook processing:", err);
  }

  response.json({ received: true });
};
