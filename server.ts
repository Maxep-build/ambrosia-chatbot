import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, GenerateContentResponse, Tool, Type } from '@google/genai';
import twilio from 'twilio';

const systemInstruction = `You are an AI customer support assistant for Ambrosia Cafe & Bakery, a cafe and bakery located at 14/3 Mall Road, Civil Lines, Kanpur, Uttar Pradesh.

Your job is to help customers by answering their questions about the business via WhatsApp. You are friendly, helpful, and concise. Always reply in the same language the customer uses.

---

BUSINESS INFORMATION:
- Name: Ambrosia Cafe & Bakery
- Type: Cafe and Bakery
- Address: 14/3 Mall Road, Civil Lines, Kanpur, UP 208001
- Phone: +91 98765 43210
- Opening Hours: Monday to Saturday 8:00 AM – 9:30 PM, Sunday 9:00 AM – 8:00 PM
- Delivery Available: Yes
- Delivery Areas: Civil Lines, Kakadeo, Kidwai Nagar, Swaroop Nagar, Harsh Nagar
- Delivery Charge: ₹30 flat for orders below ₹300, free above ₹300
- Minimum Order: ₹150

---

MENU:

CAKES (whole):
- Black Forest Cake (500g) - ₹450
- Black Forest Cake (1kg) - ₹850
- Chocolate Truffle Cake (500g) - ₹500
- Chocolate Truffle Cake (1kg) - ₹950
- Pineapple Cake (500g) - ₹400
- Pineapple Cake (1kg) - ₹750
- Red Velvet Cake (500g) - ₹550
- Red Velvet Cake (1kg) - ₹1000
- Butterscotch Cake (500g) - ₹420
- Eggless options available on all cakes (same price)

PASTRIES & SLICES:
- Chocolate Pastry - ₹80
- Black Forest Pastry - ₹80
- Pineapple Pastry - ₹70
- Red Velvet Slice - ₹90
- Brownie - ₹60
- Blueberry Cheesecake Slice - ₹120

BREADS & BAKES:
- Plain Croissant - ₹70
- Butter Croissant - ₹80
- Cheese & Herb Croissant - ₹110
- Garlic Bread (4 pieces) - ₹90
- Whole Wheat Bread (loaf) - ₹85
- Banana Walnut Muffin - ₹75
- Chocolate Chip Muffin - ₹75
- Blueberry Muffin - ₹80

DRINKS:
- Cold Coffee - ₹120
- Iced Latte - ₹130
- Hot Cappuccino - ₹100
- Hot Latte - ₹110
- Masala Chai - ₹50
- Hot Chocolate - ₹130
- Mango Smoothie - ₹140
- Oreo Shake - ₹150
- Fresh Lime Soda - ₹70

SANDWICHES & SNACKS:
- Veg Club Sandwich - ₹130
- Chicken Club Sandwich - ₹160
- Paneer Tikka Sandwich - ₹140
- Veg Puff - ₹40
- Chicken Puff - ₹50

---

SPECIAL OFFERS:
- Happy Hours 3 PM – 5 PM daily: Buy any 2 pastries get 1 free
- Monday Special: 20% off on all whole cakes ordered on Monday
- Combo Deal: Any sandwich + cold coffee = ₹220 (save ₹30)
- Bulk order discount: Order above ₹1500 and get 10% off

---

YOUR BEHAVIOR RULES:

1. ANSWER these questions automatically and confidently:
   - Menu items and prices
   - Availability of items
   - Opening and closing hours
   - Location and how to reach
   - Delivery information and charges
   - Current offers and discounts
   - Order placement (collect: item, quantity, name, phone, delivery or pickup, preferred time)

2. When taking an ORDER, follow this exact flow:
   Step 1 - Ask what items they want and quantity
   Step 2 - Ask delivery or pickup
   Step 3 - If delivery, ask their address
   Step 4 - Ask their phone number and name
   Step 5 - Confirm full order summary with total price
   Step 6 - Trigger the 'notifyOwnerOfOrder' function silently to notify the owner. Say: "Your order has been noted. The owner will confirm shortly on this number."

3. ESCALATE to human (say "Let me connect you with our team for this") when:
   - Customer has a complaint
   - Custom cake with photo or special message request above ₹2000
   - Payment issue or refund request
   - Question you are not confident about
   - Customer is angry or upset

4. NEVER:
   - Make up prices or items not in the menu
   - Promise exact delivery times you are not sure about
   - Discuss competitors
   - Share owner's personal contact details

5. TONE:
   - Warm and friendly, like a helpful staff member
   - Keep replies short — maximum 3-4 lines per message
   - Use simple language, avoid corporate jargon
   - If customer writes in Hindi or Hinglish, reply in the same style

---

START every new conversation with:
"Hi! Welcome to Ambrosia Cafe & Bakery 🙏 How can I help you today?"`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Needed for parsing JSON bodies
  app.use(express.json());

  // Wait to initialize AI so that missing keys don't crash startup unless actually used
  let ai: GoogleGenAI | null = null;
  const getAI = () => {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
         throw new Error("GEMINI_API_KEY is not defined");
      }
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  };

  let twilioClient: twilio.Twilio | null = null;
  const getTwilio = () => {
    if (!twilioClient) {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      } else {
        console.warn("Twilio credentials not fully set, SMS notifications disabled.");
      }
    }
    return twilioClient;
  };

  const tools: Tool[] = [{
    functionDeclarations: [
      {
        name: 'notifyOwnerOfOrder',
        description: 'Call this function ONLY when the customer has fully confirmed the order and all details have been collected.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            customerPhone: { type: Type.STRING, description: 'Customer phone number' },
            totalPrice: { type: Type.NUMBER },
            itemsOrdered: { type: Type.STRING, description: 'List of items and quantities' },
            deliveryOrPickup: { type: Type.STRING },
            address: { type: Type.STRING }
          },
          required: ['customerName', 'customerPhone', 'totalPrice', 'itemsOrdered', 'deliveryOrPickup']
        }
      }
    ]
  }];

  app.post('/api/chat', async (req, res) => {
    try {
      const aiClient = getAI();
      const { history, message } = req.body;
      
      const chat = aiClient.chats.create({
        model: 'gemini-3.1-flash-lite',
        config: {
          systemInstruction,
          temperature: 0.2,
          tools,
        },
        history: history || [],
      });
      
      const chatResp: GenerateContentResponse = await chat.sendMessage({ message });
      
      let responseText = chatResp.text || "";

      // Check if function calls were made
      if (chatResp.functionCalls && chatResp.functionCalls.length > 0) {
        for (const call of chatResp.functionCalls) {
          if (call.name === 'notifyOwnerOfOrder') {
            const args = call.args as any;
            const tc = getTwilio();
            let rawFromNum = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').replace(/['"]/g, '');
            const fromNum = rawFromNum.startsWith('whatsapp:') ? rawFromNum : `whatsapp:${rawFromNum}`;
            const toNum = 'whatsapp:+918840224266';
            
            if (tc) {
              try {
                const msgBody = `🔔 New Order!\n\n*Customer*: ${args.customerName}\n*Phone*: ${args.customerPhone}\n*Items*: ${args.itemsOrdered}\n*Total*: ₹${args.totalPrice}\n*Type*: ${args.deliveryOrPickup}\n*Address*: ${args.address || 'N/A'}`;
                await tc.messages.create({
                  body: msgBody,
                  from: fromNum,
                  to: toNum
                });
                console.log('WhatsApp notification sent');
              } catch (err) {
                console.error('Twilio notification error:', err);
              }
            } else {
               console.log("Mock WhatsApp alert:", args);
            }
          }
        }
        
        // If the model didn't return text alongside the function call, supply the default confirmation
        if (!responseText || responseText.trim() === '') {
          responseText = "Your order has been noted. The owner will confirm shortly on this number.";
        }
      }

      res.json({ text: responseText });
      
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || "Failed to process chat message" });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Note: express v5 uses '*all' but the project has express v4.21.2, so '*' is used.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
