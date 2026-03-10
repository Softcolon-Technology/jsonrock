import LegalLayout from '@/components/legal-layout'

export default function PrivacyPolicy() {
  return (
    <LegalLayout title='Privacy Policy' lastUpdated='3/3/2026'>
      <section>
        <h3>
          <b>1. Introduction</b>
        </h3>
        <p>
          Welcome to JsonRock ("we," "our," or "us"). We respect your privacy
          and are committed to protecting your personal data. This privacy
          policy will inform you as to how we look after your personal data when
          you visit our website and tell you about your privacy rights and how
          the law protects you.
        </p>
        <br />

        <h3>
          <b>2. Data We Collect</b>
        </h3>
        <p>
          We may collect, use, store, and transfer different kinds of personal
          data about you which we have grouped together as follows:
        </p>
        <ul className='list-disc ml-6 space-y-2'>
          <li>
            <b>Identity Data</b> includes name, username or similar identifier.
          </li>
          <li>
            <b>Contact Data</b> includes email address.
          </li>
          <li>
            <b>Technical Data</b> includes internet protocol (IP) address, your
            login data, browser type and version, time zone setting and
            location, and other technology on the devices you use to access this
            website.
          </li>
          <li>
            <b>Usage Data</b> includes information about how you use our
            website, products, and services.
          </li>
          <li>
            <b>Content Data</b> includes the JSON or text data you provide while
            using our editor tools.
          </li>
        </ul>
        <br />

        <h3>
          <b>3. How We Use Your Data</b>
        </h3>
        <p>
          We will only use your personal data when the law allows us to. Most
          commonly, we will use your personal data in the following
          circumstances:
        </p>
        <ul className='list-disc ml-6 space-y-2'>
          <li>
            Where we need to perform the contract we are about to enter into or
            have entered into with you.
          </li>
          <li>
            Where it is necessary for our legitimate interests and your
            interests and fundamental rights do not override those interests.
          </li>
          <li>Where we need to comply with a legal obligation.</li>
        </ul>
        <br />

        <h3>
          <b>4. Data Security</b>
        </h3>
        <p>
          We have put in place appropriate security measures to prevent your
          personal data from being accidentally lost, used, or accessed in an
          unauthorized way, altered, or disclosed.
        </p>
        <br />

        <h3>
          <b>5. Contact Us</b>
        </h3>
        <p>
          If you have any questions about this privacy policy or our privacy
          practices, please contact us at:{' '}
          <a href='mailto:support@softcolon.com' className='text-[#00B3B7]'>
            support@softcolon.com
          </a>
          .
        </p>
        <br />
      </section>
    </LegalLayout>
  )
}
