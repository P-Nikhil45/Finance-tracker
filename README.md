# Bravo Finance Tracker

This project is built from the supplied synopsis and the Database Systems Lab manual:

- Personal finance tracker website
- Database-centric rules for budgets and spending limits
- Oracle SQL plus PL/SQL procedures, functions, views, and triggers
- Frontend in HTML, CSS, and JavaScript

## Files

- [index.html](/C:/Users/pikhi/Desktop/dbs/index.html): main single-page website
- [styles.css](/C:/Users/pikhi/Desktop/dbs/styles.css): dashboard styling and responsive layout
- [app.js](/C:/Users/pikhi/Desktop/dbs/app.js): UI logic, reporting, demo storage, and backend hooks
- [database/schema.sql](/C:/Users/pikhi/Desktop/dbs/database/schema.sql): Oracle tables, constraints, and views
- [database/plsql.sql](/C:/Users/pikhi/Desktop/dbs/database/plsql.sql): PL/SQL package and triggers
- [database/queries.sql](/C:/Users/pikhi/Desktop/dbs/database/queries.sql): sample inserts and advanced report queries

## Features Mapped To The Synopsis

- Income and expense entry logging
- Monthly budget allocation by expense category
- Savings goal tracking
- Monthly cashflow and category-wise report insights
- Database-level policy enforcement for overspending

## Lab Manual Concepts Used

- DDL and DML
- Integrity constraints: primary key, foreign key, unique, check, defaults
- Intermediate SQL: views and grouped reports
- Complex queries: joins, `GROUP BY`, `HAVING`, subqueries, ranking
- PL/SQL package, procedures, functions
- Triggers for business-rule enforcement

## Frontend Behaviour

Open [index.html](/C:/Users/pikhi/Desktop/dbs/index.html) in a browser.

The page works in two modes:

1. Demo mode
   It uses browser local storage so the UI is usable immediately.
2. Oracle mode
   If a backend exposes `GET /api/bootstrap` and `POST` endpoints for transactions, budgets, and goals, the page will switch to live mode automatically.

## Running On Localhost

If `127.0.0.1` shows `ERR_EMPTY_RESPONSE`, it means no web server is running.

Start the included local server by running [start-server.bat](/C:/Users/pikhi/Desktop/dbs/start-server.bat).

Then open:

- [http://127.0.0.1:5510](http://127.0.0.1:5510)

The frontend will still work even without the Java/Oracle backend because it falls back to demo storage automatically.

## Suggested Java To Oracle Integration

Your synopsis mentions Java for database connectivity. A clean backend mapping would be:

- `GET /api/bootstrap`
  Returns user, accounts, categories, budgets, goals, and transactions
- `POST /api/transactions`
  Calls `finance_tracker_pkg.pr_add_transaction`
- `POST /api/budgets`
  Calls `finance_tracker_pkg.pr_upsert_budget`
- `POST /api/goals`
  Inserts into `savings_goal`

Use JDBC with Oracle and keep the budget validation inside the database trigger, not only in JavaScript. That aligns with the synopsis requirement and the lab-manual emphasis on database-side logic.

## Suggested Oracle Execution Order

1. Run [database/schema.sql](/C:/Users/pikhi/Desktop/dbs/database/schema.sql)
2. Run [database/plsql.sql](/C:/Users/pikhi/Desktop/dbs/database/plsql.sql)
3. Run [database/queries.sql](/C:/Users/pikhi/Desktop/dbs/database/queries.sql)

## ER-Style Entity Outline

- `app_user`
- `account`
- `category`
- `budget`
- `transaction_entry`
- `savings_goal`
- `goal_contribution`

This structure keeps the UI and the SQL layer aligned for your report, demo, and final mini-project submission.
"# Finance-tracker" 
