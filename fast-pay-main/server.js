const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect('mongodb://localhost:27017/payment', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// Define User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  upi_id: { type: String, unique: true },
  balance: { type: Number },
  twoFactorSecret: { type: String }, // For 2FA secret
  twoFactorEnabled: { type: Boolean, default: false }, // 2FA enabled flag
});

// Create User Model
const User = mongoose.model('User', userSchema);

// Define Transaction Schema
const transactionSchema = new mongoose.Schema({
  sender_upi_id: { type: String, required: true },
  receiver_upi_id: { type: String, required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Create Transaction Model
const Transaction = mongoose.model('Transaction', transactionSchema);

// Function to generate a unique UPI ID
const generateUIP = () => {
  const randomId = crypto.randomBytes(4).toString('hex'); // Generates a random 8-character ID
  return `${randomId}@fastpay`;
};

// Nodemailer Email Function
const sendTransactionEmail = async (senderEmail, receiverEmail, amount) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com', // Replace with your email
      pass: 'your-email-password',   // Replace with your email password
    },
  });

  const mailOptions = {
    from: 'your-email@gmail.com',
    to: [senderEmail, receiverEmail],
    subject: 'Transaction Notification',
    text: `A transaction of ${amount} has been made. If this was not you, please contact support immediately.`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).send({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate UPI ID
    const upi_id = generateUIP();
    const balance = 1000;

    // Create new user
    user = new User({ name, email, password: hashedPassword, upi_id, balance });
    await user.save();
    res.status(201).send({ message: 'User registered successfully!', upi_id });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

// Fetch User Details Route
app.get('/api/user/:upi_id', async (req, res) => {
  try {
    const { upi_id } = req.params;
    const user = await User.findOne({ upi_id });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    res.status(200).send(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send({ message: 'Server error' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).send({ message: 'Invalid credentials' });
    }

    // If 2FA is enabled, verify the token
    if (user.twoFactorEnabled) {
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
      });

      if (!isValid) {
        return res.status(400).send({ message: 'Invalid 2FA token' });
      }
    }

    res.status(200).send({ message: 'Login successful!', upi_id: user.upi_id, balance: user.balance });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

// Enable 2FA Route
app.post('/api/enable-2fa', async (req, res) => {
  try {
    const { upi_id } = req.body;

    // Find the user by UPI ID
    const user = await User.findOne({ upi_id });
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Generate 2FA secret and QR code
    const secret = speakeasy.generateSecret({ length: 20 });
    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = true;

    await user.save();

    // Generate QR code for the user to scan
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).send({ message: '2FA enabled successfully', qrCodeUrl });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

// Transaction Route
app.post('/api/transaction', async (req, res) => {
  try {
    const { sender_upi_id, receiver_upi_id, amount } = req.body;

    // Validate amount
    if (amount <= 0) {
      return res.status(400).send({ message: 'Invalid amount' });
    }

    // Find sender and receiver
    const sender = await User.findOne({ upi_id: sender_upi_id });
    const receiver = await User.findOne({ upi_id: receiver_upi_id });

    if (!sender) {
      return res.status(404).send({ message: 'Sender not found' });
    }
    if (!receiver) {
      return res.status(404).send({ message: 'Receiver not found' });
    }

    // Check if sender has enough balance
    if (sender.balance < amount) {
      return res.status(400).send({ message: 'Insufficient balance' });
    }

    // Perform transaction
    sender.balance -= amount;
    receiver.balance += amount;

    // Save updated users
    await sender.save();
    await receiver.save();

    // Save transaction record
    const transaction = new Transaction({ sender_upi_id, receiver_upi_id, amount });
    await transaction.save();

    // Send email notifications to both sender and receiver
    await sendTransactionEmail(sender.email, receiver.email, amount);

    res.status(200).send({ message: 'Transaction successful!' });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).send({ message: 'Server error' });
  }
});

// Get Transactions Route
app.get('/api/transactions/:upi_id', async (req, res) => {
  try {
    const { upi_id } = req.params;

    // Find transactions for the given UPI ID
    const transactions = await Transaction.find({
      $or: [{ sender_upi_id: upi_id }, { receiver_upi_id: upi_id }]
    }).sort({ timestamp: -1 });

    res.status(200).send(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
