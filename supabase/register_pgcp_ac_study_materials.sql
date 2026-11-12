-- Register PGCP-AC premium PDFs in the private study-materials bucket.
-- Run after supabase/study_materials.sql.
-- Module indexes follow the official PGCP-AC August 2026 programme order:
-- 0 C++, 1 OS & SDLC, 2 OOP with Java, 3 DSA using Java,
-- 4 Database Technologies, 5 Web Programming Technologies.
-- The syllabus is course-wide (NULL module_index), so module-only buyers do not receive it.

alter table public.study_materials
  alter column module_index drop not null;

insert into public.study_materials
  (course_code, course_name, module_index, module_name, title, storage_path, display_order, is_published)
values
  ('PGCP-AC', 'PGCP-AC', 0, 'C++ Programming',
   'Comprehensive C++ Exam Preparation Question Bank',
   'PGCP AC/C++/Comprehensive C++ Exam Preparation Question Bank.pdf', 10, true),

  ('PGCP-AC', 'PGCP-AC', 2, 'Object-Oriented Programming with Java',
   'Core Java Question Paper',
   'PGCP AC/CORE JAVA/CoreJava_QuestionPaper.pdf', 20, true),

  ('PGCP-AC', 'PGCP-AC', 4, 'Database Technologies',
   'Database Technologies Question Paper',
   'PGCP AC/DBT/DBT_question paper.pdf', 30, true),

  ('PGCP-AC', 'PGCP-AC', 5, 'Web Programming Technologies',
   'Top WPT MCQ',
   'PGCP AC/WPT/TOP WPT MCQ.pdf', 40, true),

  ('PGCP-AC', 'PGCP-AC', 5, 'Web Programming Technologies',
   'Web Technologies Practice Questions',
   'PGCP AC/WPT/WT_Practice_questions.pdf', 50, true),

  ('PGCP-AC', 'PGCP-AC', null, 'All PGCP-AC modules',
   'PGCP-AC August 2026 Syllabus & Evaluation Guidelines',
   'PGCP AC/Syllabus/PGCP-AC Aug 2026 - Syllabus & Evaluation Guidelines.pdf', 0, true)

on conflict (storage_path) do update set
  course_code = excluded.course_code,
  course_name = excluded.course_name,
  module_index = excluded.module_index,
  module_name = excluded.module_name,
  title = excluded.title,
  display_order = excluded.display_order,
  is_published = excluded.is_published;

-- Verify the registered rows.
select course_code, module_index, module_name, title, storage_path, is_published
from public.study_materials
where course_code = 'PGCP-AC'
order by display_order;
