import LegalLayout from '@/components/legal-layout'

export default function TermsOfService() {
  return (
    <LegalLayout title='Terms of Service' lastUpdated='3/3/2026'>
      <section>
        <h3>
          <b>1. Terms</b>
        </h3>
        <p>
          By accessing the website at{' '}
          <a href='https://jsonrock.com' className='text-[#00B3B7]'>
            https://jsonrock.com
          </a>
          , you are agreeing to be bound by these terms of service, all
          applicable laws and regulations, and agree that you are responsible
          for compliance with any applicable local laws.
        </p>
        <br />

        <h3>
          <b>2. Use License</b>
        </h3>
        <p>
          Permission is granted to temporarily use the tools provided on
          JsonRock's website for personal or non-commercial transitory viewing
          only. This is the grant of a license, not a transfer of title, and
          under this license you may not:
        </p>
        <ul className='list-disc ml-6 space-y-2'>
          <li>modify or copy the materials;</li>
          <li>
            use the materials for any commercial purpose, or for any public
            display;
          </li>
          <li>
            attempt to decompile or reverse engineer any software contained on
            JsonRock's website;
          </li>
          <li>
            remove any copyright or other proprietary notations from the
            materials; or
          </li>
          <li>
            transfer the materials to another person or "mirror" the materials
            on any other server.
          </li>
        </ul>
        <br />

        <h3>
          <b>3. Disclaimer</b>
        </h3>
        <p>
          The materials on JsonRock's website are provided on an 'as is' basis.
          JsonRock makes no warranties, expressed or implied, and hereby
          disclaims and negates all other warranties including, without
          limitation, implied warranties or conditions of merchantability,
          fitness for a particular purpose, or non-infringement of intellectual
          property or other violation of rights.
        </p>
        <br />

        <h3>
          <b>4. Limitations</b>
        </h3>
        <p>
          In no event shall JsonRock or its suppliers be liable for any damages
          (including, without limitation, damages for loss of data or profit, or
          due to business interruption) arising out of the use or inability to
          use the materials on JsonRock's website.
        </p>
        <br />

        <h3>
          <b>5. Accuracy of Materials</b>
        </h3>
        <p>
          The materials appearing on JsonRock's website could include technical,
          typographical, or photographic errors. JsonRock does not warrant that
          any of the materials on its website are accurate, complete or current.
        </p>
        <br />

        <h3>
          <b>6. Links</b>
        </h3>
        <p>
          JsonRock has not reviewed all of the sites linked to its website and
          is not responsible for the contents of any such linked site. The
          inclusion of any link does not imply endorsement by JsonRock of the
          site. Use of any such linked website is at the user's own risk.
        </p>
        <br />

        <h3>
          <b>7. Modifications</b>
        </h3>
        <p>
          JsonRock may revise these terms of service for its website at any time
          without notice. By using this website you are agreeing to be bound by
          the then current version of these terms of service.
        </p>
        <br />

        <h3>
          <b>8. Governing Law</b>
        </h3>
        <p>
          These terms and conditions are governed by and construed in accordance
          with the laws of the jurisdiction in which Softcolon operates and you
          irrevocably submit to the exclusive jurisdiction of the courts in that
          State or location.
        </p>
        <br />
      </section>
    </LegalLayout>
  )
}
