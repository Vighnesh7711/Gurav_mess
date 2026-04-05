Markdown
# 🍽️ Smart Mess Manager (Gurav Mess)

A full-stack hostel food ordering and billing management system tailored for Gurav Mess. This application streamlines the daily mess operations by allowing admins to manage menus and billing, while enabling students to easily place daily food orders, track their spending, and request special items.

## ✨ Features

### 👤 For Students (Users)
* **Daily Ordering:** View today's menu and place orders before the daily cutoff time (default: 11:00 AM).
* **Spending Dashboard:** Track monthly food spending, order history, and average daily expenses.
* **Food Requests:** Request special food items. If approved by the admin, the item is automatically added to that day's menu.

### 👑 For Administrators
* **Menu Management:** Create, edit, and publish the daily menu. Dynamically open or close the mess for specific dates.
* **Order Tracking:** View all student orders for any given date to prepare food quantities accurately.
* **Request Management:** Review student food requests. Approve them (and set a price) or reject them.
* **Automated Billing & Exports:** Generate monthly revenue summaries. Export individual and aggregate monthly bills to **HTML** or **PDF**.

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Custom Glassmorphism UI)
* **Backend:** Node.js, Express.js
* **Database:** MongoDB (Mongoose ODM)
* **Authentication:** JSON Web Tokens (JWT) & bcryptjs
* **Utilities:** `pdfkit` for generating downloadable PDF bills

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas URI)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/vighnesh7711/gurav_mess.git](https://github.com/vighnesh7711/gurav_mess.git)
   cd gurav_mess
Install dependencies:

Bash
npm install
Environment Setup:
Create a .env file in the root directory and add the following variables:

Code snippet
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
CUTOFF_HOUR=11
(Note: CUTOFF_HOUR is in 24-hour format IST. E.g., 11 means users cannot place orders after 11:00 AM for the current day).

Run the application:

Bash
# For development (uses nodemon)
npm run dev

# For production
npm start
Access the app:
Open your browser and navigate to http://localhost:3000.

🔐 Default Users (Auto-Seeded)
On the first run, the server will detect an empty database and automatically seed default users. You can use these to log in immediately:

Admin Account:

Name: kaki

Password: kaki123

Student (User) Accounts:

Name: vighnesh (Password: vighnesh123)

Name: jay (Password: jay123)

Name: aadi (Password: aadi123)

Name: sagar (Password: sagar123)

Name: pratik (Password: pratik123)

☁️ Deployment
This project includes a render.yaml configuration file, making it ready for 1-click deployment on Render.

Connect your GitHub repository to Render.

Select Blueprint to deploy using the render.yaml file.

Add your MONGODB_URI and JWT_SECRET as environment variables in the Render dashboard.

📂 Project Structure
Plaintext
├── middleware/       # JWT authentication and Role-based access control
├── models/           # Mongoose schemas (Menu, Order, Request, User)
├── public/           # Frontend assets (index.html, app.js, style.css)
├── routes/           # Express API endpoints
├── .env.example      # Example environment variables
├── render.yaml       # Deployment configuration for Render
└── server.js         # Application entry point and DB connection
