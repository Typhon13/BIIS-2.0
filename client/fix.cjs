const fs = require('fs');
const file = 'd:/BUET/2-1/CSE 216/Project/Main/biis-2.0_new/BIIS-2.0/client/src/pages/DashboardPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `    if (activeItem === 'Add or Drop Courses') {
      return <CourseSelection />;
    }

    if (activeItem === 'Registration and enrolled courses') {
      return <RegisteredCourses />;
    }

    return (
      <StudentDashboard
        activeItem={activeItem}
      />
    )
  }`;

content = content.replace(/    return \(\s*<StudentDashboard\s*activeItem=\{activeItem\}\s*\/>\s*\)\s*\}/m, replacement);
fs.writeFileSync(file, content);
console.log("Done");
