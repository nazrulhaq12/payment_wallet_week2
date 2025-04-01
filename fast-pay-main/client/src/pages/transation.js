import axios from "axios";
import React, { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Transaction() {
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [receiverUpi, setReceiverUpi] = useState('');
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUserAndTransactions = async () => {
            try {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                if (storedUser) {
                    setUser(storedUser);
                    fetchTransactions(storedUser.upi_id);
                    fetchBalance(storedUser.upi_id);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserAndTransactions();
    }, []);

    const fetchTransactions = async (upi_id) => {
        try {
            const response = await axios.get(`/api/transactions/${upi_id}`);
            setTransactions(response.data);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    };

    const fetchBalance = async (upi_id) => {
        try {
            const response = await axios.get(`/api/user/${upi_id}`);
            setUser(response.data);
        } catch (error) {
            console.error('Error fetching balance:', error);
        }
    };

    const handleTransaction = async () => {
        if (!amount || !receiverUpi) {
            setMessage('Please provide amount and receiver UPI ID.');
            return;
        }
        if (amount <= 0) {
            setMessage('Amount must be greater than zero.');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/transaction', {
                sender_upi_id: user.upi_id,
                receiver_upi_id: receiverUpi,
                amount: parseFloat(amount)
            });
            setMessage(response.data.message || "Transaction successful!");
            
            if (response.status === 200) {
                fetchTransactions(user.upi_id);
                fetchBalance(user.upi_id);
                setAmount('');
                setReceiverUpi('');
            }
        } catch (error) {
            console.error('Error making transaction:', error);
            setMessage('Transaction failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const chartData = transactions
        .map(tx => ({
            timestamp: new Date(tx.timestamp).toLocaleDateString(),
            amount: tx.amount,
            type: tx.type
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return (
        <div className="container">
            {user && (
                <div className="card mt-4">
                    <div className="card-body">
                        <h5 className="card-title">User Information</h5>
                        <p className="card-text"><strong>Email:</strong> {user.email}</p>
                        <p className="card-text"><strong>UPI ID:</strong> {user.upi_id}</p>
                        <p className="card-text"><strong>Balance:</strong> ₹{user.balance}</p>
                    </div>
                </div>
            )}

            <div className="card mt-4 p-4">
                <h3>Initiate Transaction</h3>
                <div className="mb-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Receiver UPI ID"
                        value={receiverUpi}
                        onChange={(e) => setReceiverUpi(e.target.value)}
                    />
                </div>
                <div className="mb-3">
                    <input
                        type="number"
                        className="form-control"
                        placeholder="Amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                <button className="btn btn-primary w-100" onClick={handleTransaction} disabled={loading}>
                    {loading ? "Processing..." : "Send Money"}
                </button>
                {message && <p className="mt-2 text-center text-info">{message}</p>}
            </div>

            <div className="mt-4">
                <h3>Transaction History</h3>
                <table className="table table-bordered">
                    <thead className="table-dark">
                        <tr>
                            <th>Symbol</th>
                            <th>Sender UPI ID</th>
                            <th>Receiver UPI ID</th>
                            <th>Amount (₹)</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr><td colSpan="5" className="text-center">No transactions found.</td></tr>
                        ) : transactions.map((transaction) => (
                            <tr key={transaction._id}>
                                <td>{transaction.sender_upi_id === user.upi_id ? '🔺' : '⬇️'}</td>
                                <td>{transaction.sender_upi_id}</td>
                                <td>{transaction.receiver_upi_id}</td>
                                <td>₹{transaction.amount.toFixed(2)}</td>
                                <td>{new Date(transaction.timestamp).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4">
                <h3>Transaction Graph</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="amount" stroke="#8884d8" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
