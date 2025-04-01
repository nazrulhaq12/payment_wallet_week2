import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.min.css";
import React, { useEffect, useState } from "react";
import { Container, Nav, Navbar, NavDropdown } from "react-bootstrap";
import { Link, Route, BrowserRouter as Router, Routes, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Transaction from "./pages/Transaction";

function App() {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (storedUser) {
            setUser(storedUser);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("user");
        setUser(null);
        navigate("/");
    };

    return (
        <Router>
            <Navbar bg="primary" variant="dark" expand="md" sticky="top">
                <Container>
                    <Navbar.Brand as={Link} to="/">Fast-Pay</Navbar.Brand>
                    <Navbar.Toggle aria-controls="navbar-nav" />
                    <Navbar.Collapse id="navbar-nav">
                        <Nav className="ms-auto">
                            {user ? (
                                <>
                                    <Nav.Link as={Link} to="/transaction">Transactions</Nav.Link>
                                    <NavDropdown title={<><i className="bi bi-person-circle"></i> {user.email}</>} id="nav-dropdown">
                                        <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
                                    </NavDropdown>
                                </>
                            ) : (
                                <>
                                    <Nav.Link as={Link} to="/login">Login</Nav.Link>
                                    <Nav.Link as={Link} to="/signup">Signup</Nav.Link>
                                </>
                            )}
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/transaction" element={<Transaction />} />
            </Routes>
        </Router>
    );
}

export default App;
