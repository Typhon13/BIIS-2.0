import StudentApplication from './StudentApplication'

export default function ScholarshipApplication() {
  return (
    <StudentApplication
      type="SCHOLARSHIP"
      title="Scholarship Application"
      amountRequired
      description="Apply for financial assistance and track the review status of your application."
    />
  )
}
