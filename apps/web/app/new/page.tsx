import { redirect } from 'next/navigation'

export default function NewPageRedirect() {
  redirect('/editor/text')
}
