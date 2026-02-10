# CiteStack Privacy Policy (Draft)

**Last updated:** 2026-02-10  
**Company:** Signal & Form LLC ("we", "us")  
**Product:** CiteStack (the "Service")

> **Draft notice:** This document is a working draft. Before publishing, confirm: company address, support/legal contact email, analytics providers, and whether minors are allowed.

## 1) Scope
This Privacy Policy explains how we collect, use, disclose, and protect information when you use CiteStack, including when you create an account, save sources (URLs, pasted text), upload files (e.g., PDFs), and run extraction/enrichment features.

## 2) Information we collect
### 2.1 Account and profile information
- Email address and authentication identifiers (via Supabase Auth).
- Basic account preferences/settings you provide.

### 2.2 Content you submit
When you use the Service, you may submit:
- **URLs** you save.
- **Pasted text** you submit.
- **Uploaded files** (e.g., PDFs) stored in Supabase Storage.
- **Collections, tags, titles, notes** or edits you make.

### 2.3 Extracted and derived data
To provide the Service, we process submitted content to generate and store:
- Extracted page metadata (e.g., title, domain) and extracted text.
- Cleaned text (may be truncated for storage/processing limits).
- AI-generated enrichments such as: summaries/abstracts, key points/bullets, quotes with context (e.g., “why it matters”), and tags.
- Comparison outputs between sources when you request comparisons.

### 2.4 Usage and device data
We collect basic operational data necessary to run and secure the Service, such as:
- Request logs (IP address, timestamps, user agent).
- Events related to job processing (queued/running/succeeded/failed).
- Diagnostic and error logs.

> If you use analytics tools (e.g., PostHog/GA), list them here before publishing.

## 3) How we use information
We use information to:
- Provide and maintain the Service (capture, extract, enrich, search, organize, cite).
- Authenticate users and enforce access controls (RLS by `user_id`).
- Store and retrieve your library items, collections, and files.
- Run background jobs for extraction/enrichment.
- Improve reliability, prevent abuse, and debug issues.
- Communicate with you about the Service (support, critical notices).

## 4) AI processing and third parties
### 4.1 OpenAI (or other AI providers)
When you run enrichment or comparison features, the Service may send relevant extracted/cleaned text (or a truncated portion) to an AI provider (e.g., OpenAI) to generate outputs.

**We do not intend to use your content to train our own models.**

> Before publishing, confirm the exact AI provider(s) and the applicable data usage policy terms.

### 4.2 Supabase
We use Supabase for:
- Authentication
- Database storage (Postgres)
- File storage (Supabase Storage)

## 5) How we share information
We may share information:
- With service providers (e.g., AI provider, Supabase, email/support tooling) solely to operate the Service.
- If required by law, legal process, or to protect rights/safety.
- In connection with a merger, acquisition, or sale of assets (with notice as required).

We do **not** sell your personal information.

## 6) Data retention
By default, we retain your account data and library content **until you delete it** or close your account, subject to limited retention for backups and logs.

Operational logs may be retained for a limited period for security and reliability.

> Before publishing, define a concrete log retention window (e.g., 30/90 days).

## 7) Security
We use reasonable administrative, technical, and physical safeguards designed to protect your information. However, no system can be guaranteed 100% secure.

## 8) Your choices and rights
Depending on your location, you may have rights to:
- Access, correct, or delete your information.
- Export your content.
- Object to or restrict certain processing.

You can delete items/files within the Service. You may request account deletion by contacting us.

## 9) Children’s privacy
CiteStack is not intended for children under **13** (or the minimum age required in your jurisdiction). If you believe a child has provided personal information, contact us.

> Confirm your intended minimum age (13/16/18) before publishing.

## 10) International transfers
If you access the Service from outside the United States, your information may be processed in the United States or other locations where our providers operate.

## 11) Changes
We may update this policy from time to time. We will update the “Last updated” date and may provide additional notice for material changes.

## 12) Contact
**Privacy contact:** _TODO: add email_  
**Mailing address:** _TODO: add address_
