# Document Classification Rules

## PDF Metadata Extraction & Semantic Classification

When analyzing PDF text, **do not rely purely on rigid keyword matching**. Instead, use **Universal Semantic Reasoning** to determine the document's fundamental purpose. The AI model's native multilingual understanding is the primary tool here.

If a document matches characteristics of multiple categories, consider its primary intent. For example, a receipt that mentions a "due date" is still a receipt, and a resume referencing "Internet technologies" is a general Document, not an internet bill.

### Invoices

- **Concept**: Any document requesting payment for specific goods or services already provided.
- **Markers**: "Bill To" / "Invoice Number" / "Due Date" / `发票` / `Factura`.
- **Naming Format**: `yyyy-mm-dd-[Vendor]-[Inv#]-[Amount].pdf`
- **Folder**: `Documents/Invoices/`

### Bills (Utility/Recurring)

- **Concept**: Recurring statements for essential services (power, water, internet, phone).
- **Markers**: Service periods / Account numbers / `账单` / `Facture`.
- **Naming Format**: `yyyy-mm-dd-[Provider]-[Service]-[Account#].pdf`
- **Folder**: `Documents/Bills/`

### Receipts

- **Concept**: Proof of payment for a completed transaction, often containing a summary of items purchased.
- **Markers**: Order summary / Payment method / `凭据` / `Recibo`.
- **Naming Format**: `yyyy-mm-dd-[Store]-[TotalAmount].pdf`
- **Folder**: `Documents/Receipts/`

### Travel Documents

- **Concept**: Itineraries, flight bookings, boarding passes, hotel reservations, or any travel-related logistics.
- **Markers**: Confirmation numbers / Flight details / `行程` / `Billete`.
- **Naming Format**: `yyyy-mm-dd-[Transport/Hotel]-[Confirmation#].pdf`
- **Folder**: `Documents/Travel/`

### Financial/Legal

- **Bank Statements**: Monthly account summaries, available balances, transactions, or investment reports.
- **Legal**: Agreements, contracts, privacy policies, or official notices.
- **Markers**: Account summaries / "Confidential" / `银行流水` / `Legal`.
- **Folder**: `Documents/Financial/` or `Documents/Legal/`

### Career & Professional

- **Concept**: Resumes, job applications, CVs, cover letters, and professional portfolios.
- **Markers**: Experience / Skills / `简历` / `CV`.
- **Folder**: `Documents/Career/`

### Writing

- **Concept**: Word processing documents, essays, and drafts.
- **Extensions**: `.docx`, `.doc`, `.pages`, `.odt`.
- **Folder**: `Documents/Writing/`

### Spreadsheets

- **Concept**: Data tables, financial sheets, and calculations.
- **Extensions**: `.xlsx`, `.xls`, `.numbers`, `.ods`, `.csv`.
- **Folder**: `Documents/Spreadsheets/`

### Presentations

- **Concept**: Slideshows, presentations, and speaker decks.
- **Extensions**: `.ppt`, `.pptx`, `.key`, `.odp`.
- **Folder**: `Documents/Presentations/`

### General Documents

- **Characteristics**: General documents that do not fall into the above categories.
- **Folder**: `Needs_Review/Documents/`

### Unknown Documents

- **Characteristics**: Documents that were analyzed by AI (content was read) but did not match any recognized category or pattern.
- **Folder**: `Needs_Review/Unknown/`

## General File Types

### Photos & Media

- **Photos**: `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`. Move to `Photos/`.
- **Screenshots**: Filenames containing "Screenshot" (Windows/iOS) or "Screen Shot" (macOS). Move to `Photos/Screenshots/`.
- **Videos**: `.mp4`, `.mov`, `.mkv`, `.avi`. Move to `Videos/`.
- **Audio**: `.mp3`, `.wav`, `.flac`, `.m4a`. Move to `Audio/`.

### Installers

- **Extensions**: `.dmg`, `.pkg`, `.exe`, `.msi`, `.app` (if in a folder).
- **Folder**: `Installers/`

### Archives

- **Extensions**: `.zip`, `.tar.gz`, `.rar`, `.7z`.
- **Folder**: `Archives/`

### Smart Folders (Others)

- **Concept**: Pre-organized project folders, git repositories, or app bundles.
- **Markers**: `.git/`, `package.json`, `.app`, etc.
- **Action**: Move as a whole unit.
- **Folder**: `Others/`
