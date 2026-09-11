export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  title: string;
  items: FaqItem[];
}

export const FAQ_DATA: FaqCategory[] = [
  {
    title: "Getting started",
    items: [
      { question: "What is Queens tech ERP?", answer: "Queens tech ERP is an all-in-one business operations workspace. It unifies inventory, sales, customers, debtors, creditors, bank, expenses, assets, employees, internal chat and reporting in one place." },
      { question: "How do I get started?", answer: "Sign in with your staff account. Your workspace opens with starter data across each module so you can begin exploring immediately." },
      { question: "What currency does the app use?", answer: "All amounts across the app are expressed in Uganda Shillings (UGX). Multi-currency bank accounts can still be opened, but reporting rolls up to UGX." },
      { question: "How do I navigate quickly?", answer: "Use the sidebar (desktop) or bottom navigation (mobile). Press CMD/CTRL + K anywhere to open the command palette and jump to any page, item or action." },
      { question: "Which roles are available?", answer: "Admin (full access), Manager (operations + finance), and Staff (transactions, orders, chat, assets, reports and help). Sensitive modules like Bank, Employees and Settings are restricted." },
    ],
  },
  {
    title: "Inventory & catalog",
    items: [
      { question: "How do I add a new item?", answer: "Go to Catalog and click '+ New item'. Fill in name, SKU, category, cost and stock. SKUs must be unique." },
      { question: "What do the stock colours mean?", answer: "Green: above reorder point. Amber: at or below reorder point. Red: out of stock. The 'Most selling' filter ranks items by movement volume." },
      { question: "How do I log a stock movement?", answer: "Open Movements → Log movement. Choose Received, Shipped, Adjusted or Transferred, pick the item and quantity." },
      { question: "How do I bulk update items?", answer: "Select rows with checkboxes in Catalog, then use the bulk action bar to change category, archive or delete." },
    ],
  },
  {
    title: "Sales, transactions & orders",
    items: [
      { question: "How is VAT handled on a sale?", answer: "VAT is optional and defaults to 18% when enabled. Toggle it on the Add Sale sheet — the line totals update automatically." },
      { question: "Walk-in customers?", answer: "If you leave the customer name blank on a transaction, the sale is recorded against 'Walk-in' automatically." },
      { question: "Can I link a sale to a company asset?", answer: "Yes. On the sale sheet, pick the asset that fulfilled the order (e.g. delivery vehicle). It appears on the transaction record and asset history." },
      { question: "How do quotations work?", answer: "On the Orders page you can attach a detailed quotation as text plus an image or PDF file. Customers receive the same document you store." },
    ],
  },
  {
    title: "Customers, debtors & creditors",
    items: [
      { question: "What's the difference between Customers, Debtors and Creditors?", answer: "Customers stores relationship data (tier, contact, LTV). Debtors tracks what customers owe you. Creditors tracks what you owe suppliers. Payments recorded in Debtors/Creditors update aging buckets automatically." },
      { question: "How do aging buckets work?", answer: "Open entries are sorted into Current, 1–30, 31–60, 61–90 and 90+ days past due. Overdue invoices are highlighted in the ledger view." },
      { question: "Can I record a partial payment?", answer: "Yes — open any debtor/creditor entry and click 'Record payment'. The balance, status and aging recompute live." },
    ],
  },
  {
    title: "Bank & expenses",
    items: [
      { question: "How do I add a bank account?", answer: "Bank → Accounts → '+ New account'. Choose currency (UGX, USD, EUR, GBP) and opening balance. Multiple accounts roll up to the dashboard." },
      { question: "Can I attach receipts to deposits & withdrawals?", answer: "Yes. On every deposit or withdrawal you can upload an image or PDF of the receipt; it is stored on the transaction record." },
      { question: "What happened to expense sub-pages?", answer: "Approvals, vendors, travel, employee, categories and claims are no longer separate pages — they're now filters on the single Expenses table for faster workflows." },
      { question: "How do I reconcile a statement?", answer: "Bank → Reconcile, pick an account, import the statement (or use the sample) and tick off matched lines." },
    ],
  },
  {
    title: "Assets & maintenance",
    items: [
      { question: "How do I record a daily meter reading?", answer: "Open the asset's detail sheet and use the meter reading logger. Service-due 'pressure' updates against both the next-service meter and date." },
      { question: "How is book value calculated?", answer: "Straight-line depreciation between purchase cost and salvage value over the asset's useful life. The detail sheet also shows TCO (cost of ownership)." },
    ],
  },
  {
    title: "Employees & chat",
    items: [
      { question: "Who can manage employees?", answer: "Admin and Manager roles. Employee records drive the 'Staff' picker in sales and the 'Employee' filter in expenses." },
      { question: "Can I share files in chat?", answer: "Yes — the composer supports images, PDFs and documents, plus @mentions, emoji and threaded replies." },
    ],
  },
  {
    title: "Approvals",
    items: [
      { question: "What can I request?", answer: "Inventory items, leave, advances, equipment, purchase requests and general approvals. Each request type has its own form and approval path." },
      { question: "Who approves a request?", answer: "Managers and Admins see a Pending Approval queue with urgent items pinned to the top. They can approve, partially approve, decline or cancel." },
      { question: "Can I track a request after submission?", answer: "Yes — open My requests to see status (Pending, Approved, Partial, Declined, Cancelled, Fulfilled) and the audit trail." },
    ],
  },
  {
    title: "Reports",
    items: [
      { question: "Which reports can I generate?", answer: "Income statement, balance sheet, cash flow, periodic P&L, expense by category, AR / AP aging, bank summary and asset register." },
      { question: "Can I pick a date range?", answer: "Yes. Reports → pick a preset (Today, MTD, YTD, 12 months) or a custom range, choose granularity (daily / weekly / monthly / quarterly / annual)." },
      { question: "How do I export?", answer: "Every report exports to PDF, Excel or CSV from the toolbar." },
    ],
  },
  {
    title: "Account & settings",
    items: [
      { question: "How do I manage users?", answer: "Admins: Settings → Users to invite, change roles or deactivate accounts." },
      { question: "How do I configure categories and custom fields?", answer: "Settings → Categories or Custom fields. Custom fields are capped at 20 to keep forms manageable." },
      { question: "Where are notification preferences?", answer: "Click the bell icon in the header, then the gear icon to choose which alerts you receive." },
    ],
  },
];
