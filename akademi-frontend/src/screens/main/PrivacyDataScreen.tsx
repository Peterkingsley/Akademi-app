import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

type Tab = "privacy" | "terms";

export const PrivacyDataScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("privacy");
  const { colors: themeColors } = useTheme();

  const styles = createStyles(themeColors);

  return (
    <Screen style={{ flex: 1 }} title="Privacy & Data" scrollable>
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "privacy" && styles.activeTab]}
            onPress={() => setActiveTab("privacy")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "privacy" && styles.activeTabText]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "terms" && styles.activeTab]}
            onPress={() => setActiveTab("terms")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "terms" && styles.activeTabText]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "privacy" ? <PrivacyPolicyContent colors={themeColors} /> : <TermsOfServiceContent colors={themeColors} />}
      </View>
    </Screen>
  );
};

const BulletItem: React.FC<{ text: string; colors: any }> = ({ text, colors }) => {
  const styles = createStyles(colors);
  return (
    <View style={styles.bulletPoint}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
};

const PrivacyPolicyContent: React.FC<{ colors: any }> = ({ colors }) => {
  const styles = createStyles(colors);
  return (
    <View style={styles.contentContainer}>
      <Text style={styles.mainTitle}>Privacy Policy — Akademi</Text>
      <Text style={styles.lastUpdated}>Effective Date: March 22, 2026</Text>
      <Text style={styles.lastUpdated}>Last Updated: March 22, 2026</Text>

      <View style={styles.divider} />

      <Text style={styles.paragraph}>
        Akademi ("we", "our", or "us") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use the Akademi mobile application.
      </Text>
      <Text style={styles.paragraph}>
        By using Akademi, you agree to the collection and use of information in accordance with this policy.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>1. Who We Are</Text>
      <Text style={styles.paragraph}>
        Akademi is an AI-powered academic companion application designed for Nigerian university students. We help students solve assignments, access verified course materials, and prepare for examinations through personalized AI tutoring.
      </Text>

      <Text style={styles.sectionTitle}>2. Information We Collect</Text>

      <Text style={styles.subSectionTitle}>2.1 Information You Provide Directly</Text>
      <Text style={styles.paragraph}>When you create an account, we collect:</Text>
      <BulletItem text="Full name" colors={colors} />
      <BulletItem text="Email address" colors={colors} />
      <BulletItem text="Password (stored in encrypted form — we never store your plain password)" colors={colors} />
      <BulletItem text="Phone number (optional)" colors={colors} />
      <BulletItem text="University, faculty, department, and academic level" colors={colors} />
      <BulletItem text="Profile photo (optional)" colors={colors} />
      <BulletItem text="Course registrations" colors={colors} />

      <Text style={styles.subSectionTitle}>2.2 Information Generated Through Your Use of the App</Text>
      <Text style={styles.paragraph}>As you use Akademi, we automatically collect:</Text>
      <BulletItem text="Assignment questions you submit to the AI" colors={colors} />
      <BulletItem text="Session history and conversation logs" colors={colors} />
      <BulletItem text="Study mode interactions and progress" colors={colors} />
      <BulletItem text="Exam preparation plans and mock exam attempts" colors={colors} />
      <BulletItem text="Course materials you upload" colors={colors} />
      <BulletItem text="Your learning profile data (subject strengths, weaknesses, study patterns)" colors={colors} />
      <BulletItem text="Device type (Android or iOS) for session management" colors={colors} />

      <Text style={styles.subSectionTitle}>2.3 Payment Information</Text>
      <Text style={styles.paragraph}>
        When you make a payment, transactions are processed by Paystack. We do not store your card details. We only receive a payment reference and confirmation from Paystack after a successful transaction.
      </Text>

      <Text style={styles.subSectionTitle}>2.4 Automatically Collected Information</Text>
      <BulletItem text="App usage data and feature interactions" colors={colors} />
      <BulletItem text="Session duration and frequency" colors={colors} />
      <BulletItem text="Error logs and crash reports (via Sentry)" colors={colors} />

      <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
      <Text style={styles.paragraph}>We use the information we collect to:</Text>
      <BulletItem text="Create and manage your Akademi account" colors={colors} />
      <BulletItem text="Personalize your AI tutoring experience based on your learning profile" colors={colors} />
      <BulletItem text="Generate AI responses to your academic questions using Claude (Anthropic)" colors={colors} />
      <BulletItem text="Provide verified course materials relevant to your department and university" colors={colors} />
      <BulletItem text="Process your payments for premium features" colors={colors} />
      <BulletItem text="Send you email notifications including account verification, password resets, and material upload confirmations" colors={colors} />
      <BulletItem text="Send you study reminders and exam countdown alerts (only if you enable notifications)" colors={colors} />
      <BulletItem text="Improve our AI models and platform by analyzing anonymized usage patterns" colors={colors} />
      <BulletItem text="Detect and prevent fraud or abuse of our platform" colors={colors} />
      <BulletItem text="Comply with applicable Nigerian laws and regulations" colors={colors} />

      <Text style={styles.sectionTitle}>4. How We Share Your Information</Text>
      <Text style={styles.paragraph}>We do not sell your personal data to third parties. We share your information only in the following circumstances:</Text>

      <Text style={styles.subSectionTitle}>4.1 Service Providers</Text>
      <Text style={styles.paragraph}>We share data with trusted third-party service providers who help us operate the platform:</Text>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={[styles.tableCell, { flex: 1 }]}>
            <Text style={styles.tableHeaderText}>Service Provider</Text>
          </View>
          <View style={[styles.tableCell, { flex: 1 }]}>
            <Text style={styles.tableHeaderText}>Purpose</Text>
          </View>
          <View style={[styles.tableCell, { flex: 1.2, borderRightWidth: 0 }]}>
            <Text style={styles.tableHeaderText}>Data Shared</Text>
          </View>
        </View>
        {[
          { provider: "Anthropic (Claude API)", purpose: "AI-powered responses", data: "Question text and context" },
          { provider: "Paystack", purpose: "Payment processing", data: "Email and amount" },
          { provider: "Resend", purpose: "Transactional emails", data: "Email and name" },
          { provider: "Cloudflare R2", purpose: "File storage", data: "Uploaded files" },
          { provider: "Sentry", purpose: "Error monitoring", data: "Anonymized logs" },
          { provider: "Render", purpose: "Cloud hosting", data: "All platform data" },
        ].map((row, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={[styles.tableCell, { flex: 1 }]}>
              <Text style={styles.tableCellText}>{row.provider}</Text>
            </View>
            <View style={[styles.tableCell, { flex: 1 }]}>
              <Text style={styles.tableCellText}>{row.purpose}</Text>
            </View>
            <View style={[styles.tableCell, { flex: 1.2, borderRightWidth: 0 }]}>
              <Text style={styles.tableCellText}>{row.data}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.subSectionTitle}>4.2 Community Features</Text>
      <Text style={styles.paragraph}>
        When you upload course materials, your contribution is anonymized. Other students can access the verified material but cannot see your personal identity as the uploader unless you choose to make this visible.
      </Text>

      <Text style={styles.subSectionTitle}>4.3 Legal Requirements</Text>
      <Text style={styles.paragraph}>
        We may disclose your information if required to do so by Nigerian law, court order, or government authority.
      </Text>

      <Text style={styles.subSectionTitle}>4.4 Business Transfers</Text>
      <Text style={styles.paragraph}>
        In the event of a merger, acquisition, or sale of our business, your data may be transferred to the new entity. We will notify you before your data is transferred and becomes subject to a different privacy policy.
      </Text>

      <Text style={styles.sectionTitle}>5. Data Storage and Security</Text>
      <Text style={styles.subSectionTitle}>5.1 Where Your Data is Stored</Text>
      <Text style={styles.paragraph}>
        Your data is stored on secure servers hosted on Render.com and Cloudflare. Our primary database server is located in Europe (closest available region to Nigeria). We take steps to ensure your data is handled in compliance with Nigeria's NDPR.
      </Text>

      <Text style={styles.subSectionTitle}>5.2 How We Protect Your Data</Text>
      <BulletItem text="All data is encrypted in transit using TLS 1.3" colors={colors} />
      <BulletItem text="All data is encrypted at rest using AES-256 encryption" colors={colors} />
      <BulletItem text="Passwords are hashed using bcrypt before storage" colors={colors} />
      <BulletItem text="Access tokens expire after 15 minutes" colors={colors} />
      <BulletItem text="We use rate limiting to prevent unauthorized access attempts" colors={colors} />

      <Text style={styles.subSectionTitle}>5.3 Data Retention</Text>
      <BulletItem text="Your account data is retained for as long as your account is active" colors={colors} />
      <BulletItem text="If you delete your account, your personal data is permanently deleted within 30 days" colors={colors} />
      <BulletItem text="Session history and AI conversation logs are retained for 12 months then automatically deleted" colors={colors} />
      <BulletItem text="Course materials you uploaded remain in the library even after account deletion (contributor identity is removed)" colors={colors} />

      <Text style={styles.sectionTitle}>6. Your Rights Under Nigeria's NDPR</Text>
      <Text style={styles.paragraph}>Under Nigeria's Data Protection Regulation (NDPR), you have the following rights:</Text>
      <BulletItem text="Right to Access: You can request a copy of all personal data we hold about you" colors={colors} />
      <BulletItem text="Right to Correction: You can update or correct your personal data at any time through the app settings" colors={colors} />
      <BulletItem text="Right to Deletion: You can request deletion of your account and personal data" colors={colors} />
      <BulletItem text="Right to Portability: You can request your data in a structured, machine-readable format" colors={colors} />
      <BulletItem text="Right to Object: You can object to processing of your data for certain purposes" colors={colors} />
      <BulletItem text="Right to Withdraw Consent: You can withdraw consent for non-essential data processing at any time" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        To exercise any of these rights, contact us at privacy@akademi.app
      </Text>

      <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
      <Text style={styles.paragraph}>
        Akademi is designed for university students who are 16 years of age or older. We do not knowingly collect personal information from children under 16. If we become aware that a child under 16 has provided us with personal information, we will delete it immediately.
      </Text>

      <Text style={styles.sectionTitle}>8. AI and Automated Decision Making</Text>
      <Text style={styles.paragraph}>
        Akademi uses artificial intelligence (Claude by Anthropic) to generate responses to your academic questions. The AI:
      </Text>
      <BulletItem text="Does not make decisions that have legal or significant effects on you" colors={colors} />
      <BulletItem text="Uses your learning profile and course context to personalize responses" colors={colors} />
      <BulletItem text="Does not store your conversations directly — conversation history is stored in our own database and referenced when needed" colors={colors} />
      <BulletItem text="Is guided by discipline-specific documents we have created to ensure academically accurate responses for your department" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        You can request to opt out of learning profile personalization by contacting us, though this will significantly reduce the quality of AI responses you receive.
      </Text>

      <Text style={styles.sectionTitle}>9. Cookies and Tracking</Text>
      <Text style={styles.paragraph}>
        Akademi is a mobile application and does not use browser cookies. We use AsyncStorage on your device to store your login tokens and preferences. This data never leaves your device except as part of authorized API calls to our servers.
      </Text>

      <Text style={styles.sectionTitle}>10. Third Party Links</Text>
      <Text style={styles.paragraph}>
        Akademi may contain links to third party websites or services (such as Paystack's payment page). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
      </Text>

      <Text style={styles.sectionTitle}>11. Changes to This Privacy Policy</Text>
      <Text style={styles.paragraph}>
        We may update this Privacy Policy from time to time. When we make significant changes, we will notify you through the app and update the "Last Updated" date at the top of this document. Your continued use of Akademi after changes are posted constitutes your acceptance of the updated policy.
      </Text>

      <Text style={styles.sectionTitle}>12. Contact Us</Text>
      <Text style={styles.paragraph}>
        If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:
      </Text>
      <Text style={[styles.paragraph, { fontWeight: "700" }]}>Email: privacy@akademi.app</Text>
      <Text style={[styles.paragraph, { fontWeight: "700" }]}>Address: Lagos, Nigeria</Text>
      <Text style={styles.paragraph}>We will respond to all privacy-related requests within 14 business days.</Text>
    </View>
  );
};

const TermsOfServiceContent: React.FC<{ colors: any }> = ({ colors }) => {
  const styles = createStyles(colors);
  return (
    <View style={styles.contentContainer}>
      <Text style={styles.mainTitle}>Terms of Service — Akademi</Text>
      <Text style={styles.lastUpdated}>Effective Date: March 22, 2026</Text>
      <Text style={styles.lastUpdated}>Last Updated: March 22, 2026</Text>

      <View style={styles.divider} />

      <Text style={styles.paragraph}>
        Please read these Terms of Service carefully before using Akademi. By creating an account or using the Akademi application, you agree to be bound by these terms. If you do not agree, do not use Akademi.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>1. About Akademi</Text>
      <Text style={styles.paragraph}>
        Akademi is an AI-powered academic companion application that helps Nigerian university students solve assignments, access verified course materials, practice for examinations, and learn through personalized AI tutoring. Akademi is operated from Lagos, Nigeria.
      </Text>

      <Text style={styles.sectionTitle}>2. Eligibility</Text>
      <Text style={styles.paragraph}>To use Akademi, you must:</Text>
      <BulletItem text="Be enrolled in or have recently completed a Nigerian university program" colors={colors} />
      <BulletItem text="Be at least 16 years of age" colors={colors} />
      <BulletItem text="Have a valid email address" colors={colors} />
      <BulletItem text="Have access to an Android or iOS smartphone" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        By creating an account, you confirm that you meet all eligibility requirements.
      </Text>

      <Text style={styles.sectionTitle}>3. Your Account</Text>
      <Text style={styles.subSectionTitle}>3.1 Registration</Text>
      <Text style={styles.paragraph}>
        You must provide accurate and complete information when creating your account. You are responsible for keeping your account information up to date.
      </Text>

      <Text style={styles.subSectionTitle}>3.2 Account Security</Text>
      <Text style={styles.paragraph}>
        You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. If you suspect unauthorized access to your account, notify us immediately at support@akademi.app.
      </Text>

      <Text style={styles.subSectionTitle}>3.3 One Account Per Person</Text>
      <Text style={styles.paragraph}>
        You may only create one account per person. Creating multiple accounts to circumvent limits or restrictions is prohibited.
      </Text>

      <Text style={styles.subSectionTitle}>3.4 Multi-Device Access</Text>
      <Text style={styles.paragraph}>
        You may log into your Akademi account on multiple devices simultaneously. You can manage and terminate individual device sessions from your account settings.
      </Text>

      <Text style={styles.sectionTitle}>4. Acceptable Use</Text>
      <Text style={styles.subSectionTitle}>4.1 Permitted Uses</Text>
      <Text style={styles.paragraph}>You may use Akademi to:</Text>
      <BulletItem text="Submit academic questions and receive AI-generated explanations and answers" colors={colors} />
      <BulletItem text="Upload and access verified course materials" colors={colors} />
      <BulletItem text="Practice for examinations using AI-generated question banks" colors={colors} />
      <BulletItem text="Participate in live AI tutoring sessions" colors={colors} />
      <BulletItem text="Build a personalized learning profile over time" colors={colors} />

      <Text style={styles.subSectionTitle}>4.2 Prohibited Uses</Text>
      <Text style={styles.paragraph}>You may not use Akademi to:</Text>
      <BulletItem text="Submit work generated by Akademi as your own in academic assessments without proper disclosure (academic dishonesty)" colors={colors} />
      <BulletItem text="Upload copyrighted materials without authorization from the copyright holder" colors={colors} />
      <BulletItem text="Upload harmful, offensive, or inappropriate content" colors={colors} />
      <BulletItem text="Attempt to reverse engineer, hack, or tamper with the platform" colors={colors} />
      <BulletItem text="Use automated bots or scripts to interact with the platform" colors={colors} />
      <BulletItem text="Share your account credentials with others" colors={colors} />
      <BulletItem text="Resell or redistribute Akademi content or AI responses" colors={colors} />
      <BulletItem text="Use the platform for any illegal purpose under Nigerian law" colors={colors} />
      <BulletItem text="Attempt to manipulate or jailbreak the AI system" colors={colors} />

      <Text style={styles.subSectionTitle}>4.3 Academic Integrity</Text>
      <Text style={styles.paragraph}>
        Akademi is designed as a learning tool — not a shortcut. We strongly encourage you to use Akademi to genuinely understand topics, not simply to copy answers. We are not responsible for any academic consequences resulting from how you use AI-generated content from our platform.
      </Text>

      <Text style={styles.sectionTitle}>5. Course Materials and Content</Text>
      <Text style={styles.subSectionTitle}>5.1 Uploading Materials</Text>
      <Text style={styles.paragraph}>When you upload course materials to Akademi, you confirm that:</Text>
      <BulletItem text="You have the legal right to share the material" colors={colors} />
      <BulletItem text="The material does not infringe on any third-party copyright" colors={colors} />
      <BulletItem text="The material is relevant academic content (lecture notes, past questions, textbook summaries)" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        You grant Akademi a non-exclusive, royalty-free license to store, process, and display the material as part of the verification and library system.
      </Text>

      <Text style={styles.subSectionTitle}>5.2 Verification System</Text>
      <Text style={styles.paragraph}>
        Uploaded materials are not immediately published. They enter a verification queue and are only published after a minimum of 10 independent uploads of the same content pass our AI-powered similarity and quality checks. We reserve the right to reject or remove any material that violates these terms.
      </Text>

      <Text style={styles.subSectionTitle}>5.3 Content You Are Responsible For</Text>
      <Text style={styles.paragraph}>
        You are solely responsible for any content you upload. Akademi is not liable for copyright infringement resulting from materials you upload. If a copyright owner contacts us about your uploaded content, we will remove it and may suspend your account.
      </Text>

      <Text style={styles.subSectionTitle}>5.4 Akademi-Generated Content</Text>
      <Text style={styles.paragraph}>
        AI responses, generated questions, study plans, and session summaries generated by Akademi are for your personal educational use only. You may not reproduce, sell, or distribute this content without our written permission.
      </Text>

      <Text style={styles.sectionTitle}>6. Payments and Subscriptions</Text>
      <Text style={styles.subSectionTitle}>6.1 Feature-Based Access</Text>
      <Text style={styles.paragraph}>
        Akademi operates on a feature-based payment model. You can unlock specific features for a set time window or number of uses. The following features are available as paid unlocks:
      </Text>
      <BulletItem text="Assignment Solving (time window: 7 days or 30 days)" colors={colors} />
      <BulletItem text="Live AI Tutoring (time window: 7 days or 30 days)" colors={colors} />
      <BulletItem text="Exam Prep Questions (use-based: 5 or 10 attempts)" colors={colors} />
      <BulletItem text="Question Reply Mode (use-based)" colors={colors} />
      <BulletItem text="Wrongly Reply Mode (use-based)" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        The following features are permanently free for all users:
      </Text>
      <BulletItem text="Course Material Downloads" colors={colors} />
      <BulletItem text="Study Mode" colors={colors} />

      <Text style={styles.subSectionTitle}>6.2 Payment Processing</Text>
      <Text style={styles.paragraph}>
        All payments are processed by Paystack, a licensed Nigerian payment processor. By making a payment, you also agree to Paystack's terms of service. Akademi does not store your card details.
      </Text>

      <Text style={styles.subSectionTitle}>6.3 Pricing</Text>
      <Text style={styles.paragraph}>
        Prices are displayed in Nigerian Naira (NGN) within the app. We reserve the right to change pricing at any time with reasonable notice. Price changes will not affect active unexpired access periods.
      </Text>

      <Text style={styles.subSectionTitle}>6.4 Refunds</Text>
      <Text style={styles.paragraph}>
        Due to the digital nature of our services, all payments are final and non-refundable except in the following circumstances:
      </Text>
      <BulletItem text="You were charged but did not receive access due to a technical error on our part" colors={colors} />
      <BulletItem text="A duplicate charge occurred" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        To request a refund for a valid reason, contact us at support@akademi.app within 7 days of the charge.
      </Text>

      <Text style={styles.subSectionTitle}>6.5 Failed Payments</Text>
      <Text style={styles.paragraph}>
        If a payment fails, your access will not be activated. Contact your bank or Paystack support if you believe a payment was incorrectly declined.
      </Text>

      <Text style={styles.sectionTitle}>7. AI Services</Text>
      <Text style={styles.subSectionTitle}>7.1 Nature of AI Responses</Text>
      <Text style={styles.paragraph}>
        Akademi uses Claude (by Anthropic) to generate AI responses. While we take significant steps to ensure accuracy through course-specific context and discipline documents, AI responses may occasionally contain errors.
      </Text>
      <Text style={[styles.paragraph, { marginTop: 8 }]}>AI responses are:</Text>
      <BulletItem text="Educational guidance, not professional or expert advice" colors={colors} />
      <BulletItem text="Based on course context and publicly available academic knowledge" colors={colors} />
      <BulletItem text="Not a substitute for your lecturer, tutor, or official course materials" colors={colors} />

      <Text style={styles.subSectionTitle}>7.2 AI Limitations</Text>
      <Text style={styles.paragraph}>You acknowledge that:</Text>
      <BulletItem text="AI responses may not always be 100% accurate" colors={colors} />
      <BulletItem text="You should verify important information with your course lecturer or official textbooks" colors={colors} />
      <BulletItem text="Akademi is not liable for academic consequences arising from reliance on AI-generated content" colors={colors} />

      <Text style={styles.subSectionTitle}>7.3 Usage Limits</Text>
      <Text style={styles.paragraph}>
        To ensure fair access and manage costs, AI requests are subject to daily limits based on your access tier:
      </Text>
      <BulletItem text="Free users: 10 AI requests per day" colors={colors} />
      <BulletItem text="Users with any active paid feature: 50 AI requests per day" colors={colors} />

      <Text style={styles.sectionTitle}>8. Intellectual Property</Text>
      <Text style={styles.subSectionTitle}>8.1 Our Intellectual Property</Text>
      <Text style={styles.paragraph}>
        All aspects of Akademi — including the app design, code, AI system architecture, brand, logo, and name — are the intellectual property of Akademi. You may not copy, reproduce, or distribute any part of the platform without our written permission.
      </Text>

      <Text style={styles.subSectionTitle}>8.2 Your Content</Text>
      <Text style={styles.paragraph}>
        You retain ownership of content you create and upload. By uploading content to Akademi, you grant us a license to use, store, and display it within the platform as described in Section 5.
      </Text>

      <Text style={styles.sectionTitle}>9. Privacy</Text>
      <Text style={styles.paragraph}>
        Your use of Akademi is also governed by our Privacy Policy, which is incorporated into these Terms of Service by reference. Please review our Privacy Policy to understand how we collect and use your information.
      </Text>

      <Text style={styles.sectionTitle}>10. Termination</Text>
      <Text style={styles.subSectionTitle}>10.1 Termination by You</Text>
      <Text style={styles.paragraph}>
        You may delete your account at any time from the Profile settings screen. Upon deletion, your personal data will be removed within 30 days in accordance with our Privacy Policy.
      </Text>

      <Text style={styles.subSectionTitle}>10.2 Termination by Us</Text>
      <Text style={styles.paragraph}>
        We reserve the right to suspend or terminate your account without notice if you:
      </Text>
      <BulletItem text="Violate any provision of these Terms of Service" colors={colors} />
      <BulletItem text="Upload copyrighted or harmful content" colors={colors} />
      <BulletItem text="Attempt to abuse or manipulate the AI system" colors={colors} />
      <BulletItem text="Engage in fraudulent payment activity" colors={colors} />
      <BulletItem text="Create multiple accounts to circumvent restrictions" colors={colors} />

      <Text style={styles.subSectionTitle}>10.3 Effect of Termination</Text>
      <Text style={styles.paragraph}>
        Upon termination, your access to Akademi and all paid features will end immediately. Any unused paid access will not be refunded unless termination was caused by our error.
      </Text>

      <Text style={styles.sectionTitle}>11. Disclaimers</Text>
      <Text style={styles.subSectionTitle}>11.1 Service Availability</Text>
      <Text style={styles.paragraph}>
        Akademi is provided "as is" and "as available". We do not guarantee that the service will be uninterrupted, error-free, or available at all times. We may perform maintenance, updates, or experience outages that temporarily affect access.
      </Text>

      <Text style={styles.subSectionTitle}>11.2 Educational Purpose</Text>
      <Text style={styles.paragraph}>
        Akademi is an educational tool. We do not guarantee any specific academic outcome, examination result, or improvement in grades from using our platform.
      </Text>

      <Text style={styles.subSectionTitle}>11.3 Third Party Services</Text>
      <Text style={styles.paragraph}>
        Akademi integrates with third-party services including Anthropic, Paystack, and Cloudflare. We are not responsible for the availability or performance of these services.
      </Text>

      <Text style={styles.sectionTitle}>12. Limitation of Liability</Text>
      <Text style={styles.paragraph}>
        To the maximum extent permitted by Nigerian law, Akademi shall not be liable for:
      </Text>
      <BulletItem text="Any indirect, incidental, or consequential damages arising from your use of the platform" colors={colors} />
      <BulletItem text="Academic consequences resulting from your use of AI-generated content" colors={colors} />
      <BulletItem text="Data loss due to circumstances beyond our reasonable control" colors={colors} />
      <BulletItem text="Losses arising from unauthorized access to your account" colors={colors} />
      <Text style={[styles.paragraph, { marginTop: 8 }]}>
        Our total liability to you for any claim arising from your use of Akademi shall not exceed the amount you paid to Akademi in the 3 months preceding the claim.
      </Text>

      <Text style={styles.sectionTitle}>13. Governing Law</Text>
      <Text style={styles.paragraph}>
        These Terms of Service are governed by the laws of the Federal Republic of Nigeria. Any disputes arising from these terms shall be resolved in the courts of Lagos State, Nigeria.
      </Text>

      <Text style={styles.sectionTitle}>14. Changes to These Terms</Text>
      <Text style={styles.paragraph}>
        We may update these Terms of Service from time to time. When we make significant changes, we will notify you through the app and update the "Last Updated" date. Your continued use of Akademi after changes are posted constitutes your acceptance of the updated terms.
      </Text>

      <Text style={styles.sectionTitle}>15. Contact Us</Text>
      <Text style={styles.paragraph}>
        If you have any questions about these Terms of Service, please contact us:
      </Text>
      <Text style={[styles.paragraph, { fontWeight: "700" }]}>Email: legal@akademi.app</Text>
      <Text style={[styles.paragraph, { fontWeight: "700" }]}>Address: Lagos, Nigeria</Text>
      <Text style={styles.paragraph}>We will respond to all legal enquiries within 14 business days.</Text>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 10.5,
    fontFamily: "Inter-SemiBold",
    color: colors.textSecondary,
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  contentContainer: {
    gap: 16,
  },
  mainTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  lastUpdated: {
    ...typography.caption,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 4,
  },
  subSectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 2,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bulletPoint: {
    flexDirection: "row",
    paddingLeft: 8,
    gap: 8,
    marginVertical: 2,
  },
  bullet: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bulletText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeader: {
    backgroundColor: colors.surfaceElevated,
  },
  tableCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: "center",
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    textTransform: "uppercase",
  },
  tableCellText: {
    fontSize: 9,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
  }
});
