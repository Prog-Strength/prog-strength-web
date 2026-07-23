import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Prog Strength",
  description: "How Prog Strength collects, uses, and protects your data.",
};

/**
 * Public privacy policy. Lives outside the `(app)` route group so it is
 * served unauthenticated — third parties (Whoop's developer dashboard,
 * the App Store listing) require a reachable policy URL, and users should
 * be able to read it before signing in.
 *
 * Pure static content: no API calls, no client JS.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed text-muted">{children}</p>;
}

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <article className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-faint">Effective July 22, 2026</p>
          <p className="leading-relaxed text-muted">
            Prog Strength is a personal fitness tracking and AI coaching service. This policy
            explains what data it collects, how that data is used, and the choices you have. The
            short version: your data is used to run the product for you — it is never sold, and
            never used for advertising.
          </p>
        </header>

        <Section title="Data you provide">
          <P>
            <span className="text-foreground">Account information.</span> Signing in uses Google
            OAuth. Prog Strength stores your email address, your name, and your profile picture as
            provided by Google, along with profile details you add yourself (display name, height,
            birthdate, and similar).
          </P>
          <P>
            <span className="text-foreground">Fitness and nutrition data.</span> The product exists
            to record what you log: workouts, sets and weights, runs, steps, bodyweight, meals and
            macros, goals, and messages you exchange with the AI coach.
          </P>
        </Section>

        <Section title="Data from connected services">
          <P>
            You can optionally connect third-party services from Settings → Integrations. Each
            connection is created only when you explicitly authorize it, and you can disconnect at
            any time, which revokes Prog Strength&rsquo;s access with that provider.
          </P>
          <P>
            <span className="text-foreground">Whoop.</span> If you connect a Whoop account, Prog
            Strength receives your daily recovery data — recovery score, resting heart rate, and
            heart-rate variability — and your basic Whoop profile. This data is used solely to
            display your recovery inside Prog Strength and to inform the AI coach&rsquo;s guidance
            to you.
          </P>
          <P>
            <span className="text-foreground">Google Calendar.</span> If you connect Google
            Calendar, Prog Strength writes your planned workouts to the calendar you choose. It does
            not read your other calendar events.
          </P>
          <P>
            OAuth tokens for connected services are stored encrypted (AES-256-GCM) and are used only
            to perform the syncing described above.
          </P>
        </Section>

        <Section title="How data is used">
          <P>
            Your data is used to provide the product: displaying your history and progress, powering
            the AI coach, and syncing with services you connect. The AI coaching features send
            relevant portions of your data (for example, recent workouts or a message you type) to
            large-language-model providers — currently Anthropic and OpenAI — to generate responses.
            These providers process the data to serve the request and do not use it to train their
            models under the API terms Prog Strength operates under.
          </P>
          <P>
            Aggregate, non-identifying operational metrics (request counts, error rates) are used to
            keep the service healthy. There is no third-party advertising or analytics tracking.
          </P>
        </Section>

        <Section title="Storage and security">
          <P>
            Data is stored on infrastructure hosted by Amazon Web Services in the United States.
            Traffic is encrypted in transit with TLS, third-party access tokens are encrypted at
            rest, and access to production systems is limited to the operator of the service.
          </P>
        </Section>

        <Section title="Sharing">
          <P>
            Your personal data is never sold or rented. It is shared only with the service providers
            named above (AWS for hosting, Anthropic and OpenAI for AI features, and any integration
            you explicitly connect), and otherwise only if required by law.
          </P>
        </Section>

        <Section title="Your choices">
          <P>
            You can edit your profile and disconnect any integration from Settings at any time.
            Disconnecting an integration deletes its stored tokens immediately; data already synced
            into your account remains yours and stays visible until you delete it. To delete your
            account and all associated data, email the address below and it will be removed.
          </P>
        </Section>

        <Section title="Changes and contact">
          <P>
            If this policy changes materially, the effective date above will be updated. Questions
            and deletion requests:{" "}
            <a
              href="mailto:jimmy.wallace145@gmail.com"
              className="text-accent underline underline-offset-2"
            >
              jimmy.wallace145@gmail.com
            </a>
            .
          </P>
        </Section>
      </article>
    </main>
  );
}
