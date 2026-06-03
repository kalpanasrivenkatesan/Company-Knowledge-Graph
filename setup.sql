-- ============================================================
-- Company Analytics Dashboard - SQL Server Setup Script
-- Run this in SQL Server Management Studio (SSMS)
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'CompanyDB')
    CREATE DATABASE CompanyDB;
GO

USE CompanyDB;
GO

-- ============================================================
-- DROP TABLES (in dependency order)
-- ============================================================
IF OBJECT_ID('dbo.ProjectAssignments','U') IS NOT NULL DROP TABLE dbo.ProjectAssignments;
IF OBJECT_ID('dbo.Projects','U')           IS NOT NULL DROP TABLE dbo.Projects;
IF OBJECT_ID('dbo.Employees','U')          IS NOT NULL DROP TABLE dbo.Employees;
IF OBJECT_ID('dbo.Departments','U')        IS NOT NULL DROP TABLE dbo.Departments;
GO

-- ============================================================
-- CREATE TABLES
-- ============================================================

CREATE TABLE Departments (
    DepartmentID    INT PRIMARY KEY IDENTITY(1,1),
    Name            NVARCHAR(100) NOT NULL,
    Location        NVARCHAR(100),
    Budget          DECIMAL(15,2),
    EstablishedDate DATE
);
GO

CREATE TABLE Employees (
    EmployeeID   INT PRIMARY KEY IDENTITY(1,1),
    FirstName    NVARCHAR(50)  NOT NULL,
    LastName     NVARCHAR(50)  NOT NULL,
    Email        NVARCHAR(100),
    Phone        NVARCHAR(20),
    JobTitle     NVARCHAR(100),
    Salary       DECIMAL(10,2),
    HireDate     DATE,
    DepartmentID INT,
    ManagerID    INT,
    Status       NVARCHAR(20) DEFAULT 'Active'
);
GO

ALTER TABLE Employees ADD CONSTRAINT FK_Emp_Dept    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID);
ALTER TABLE Employees ADD CONSTRAINT FK_Emp_Manager FOREIGN KEY (ManagerID)    REFERENCES Employees(EmployeeID);
GO

CREATE TABLE Projects (
    ProjectID    INT PRIMARY KEY IDENTITY(1,1),
    Name         NVARCHAR(200) NOT NULL,
    Description  NVARCHAR(500),
    StartDate    DATE,
    EndDate      DATE,
    Budget       DECIMAL(15,2),
    Status       NVARCHAR(50),   -- Planning | In Progress | Completed | On Hold
    DepartmentID INT REFERENCES Departments(DepartmentID)
);
GO

CREATE TABLE ProjectAssignments (
    AssignmentID   INT PRIMARY KEY IDENTITY(1,1),
    ProjectID      INT REFERENCES Projects(ProjectID),
    EmployeeID     INT REFERENCES Employees(EmployeeID),
    Role           NVARCHAR(100),
    HoursAllocated INT,
    StartDate      DATE,
    EndDate        DATE
);
GO

-- ============================================================
-- INSERT DEPARTMENTS
-- ============================================================
INSERT INTO Departments (Name, Location, Budget, EstablishedDate) VALUES
('Engineering',     'Building A, Floor 3', 2500000.00, '2010-01-15'),
('Marketing',       'Building B, Floor 1', 1200000.00, '2010-03-20'),
('Sales',           'Building B, Floor 2', 1800000.00, '2010-03-20'),
('Human Resources', 'Building A, Floor 1',  800000.00, '2010-01-15'),
('Finance',         'Building A, Floor 2', 1000000.00, '2010-06-01');
GO

-- ============================================================
-- INSERT EMPLOYEES (Level 1 → 2 → 3 → 4)
-- ============================================================
-- CEO (ManagerID = NULL)
INSERT INTO Employees (FirstName,LastName,Email,Phone,JobTitle,Salary,HireDate,DepartmentID,ManagerID) VALUES
('Robert','Chen','r.chen@company.com','+1-555-0101','CEO',250000.00,'2010-01-01',4,NULL);
-- ID = 1

-- VPs (ManagerID = 1)
INSERT INTO Employees (FirstName,LastName,Email,Phone,JobTitle,Salary,HireDate,DepartmentID,ManagerID) VALUES
('Sarah','Johnson','s.johnson@company.com','+1-555-0102','VP Engineering',180000.00,'2010-02-01',1,1),
('Michael','Davis','m.davis@company.com','+1-555-0103','VP Sales & Marketing',170000.00,'2010-02-15',2,1),
('Emily','Wilson','e.wilson@company.com','+1-555-0104','VP Finance',160000.00,'2010-03-01',5,1),
('James','Brown','j.brown@company.com','+1-555-0105','VP Human Resources',155000.00,'2010-03-15',4,1);
-- IDs = 2,3,4,5

-- Managers (ManagerID = VP)
INSERT INTO Employees (FirstName,LastName,Email,Phone,JobTitle,Salary,HireDate,DepartmentID,ManagerID) VALUES
('Lisa','Martinez','l.martinez@company.com','+1-555-0106','Engineering Manager',  130000.00,'2011-01-10',1,2),
('David','Taylor','d.taylor@company.com','+1-555-0107','Engineering Manager',     128000.00,'2011-03-15',1,2),
('Anna','Anderson','a.anderson@company.com','+1-555-0108','Marketing Manager',    120000.00,'2011-06-01',2,3),
('Kevin','Thomas','k.thomas@company.com','+1-555-0109','Sales Manager',           125000.00,'2011-08-15',3,3),
('Patricia','Jackson','p.jackson@company.com','+1-555-0110','Finance Manager',    115000.00,'2012-01-10',5,4),
('Daniel','White','d.white@company.com','+1-555-0111','HR Manager',               110000.00,'2012-03-20',4,5);
-- IDs = 6,7,8,9,10,11

-- Individual Contributors
INSERT INTO Employees (FirstName,LastName,Email,Phone,JobTitle,Salary,HireDate,DepartmentID,ManagerID) VALUES
('Chris','Harris','c.harris@company.com','+1-555-0112','Senior Developer', 95000.00,'2013-02-10',1,6),
('Ashley','Clark','a.clark@company.com','+1-555-0113','Senior Developer',  93000.00,'2013-05-20',1,6),
('Brandon','Lewis','b.lewis@company.com','+1-555-0114','Developer',        78000.00,'2015-07-15',1,6),
('Stephanie','Lee','s.lee@company.com','+1-555-0115','Developer',          76000.00,'2015-09-01',1,7),
('Tyler','Walker','t.walker@company.com','+1-555-0116','Junior Developer', 62000.00,'2018-01-15',1,7),
('Rachel','Hall','r.hall@company.com','+1-555-0117','QA Engineer',         70000.00,'2016-03-10',1,7),
('Justin','Young','j.young@company.com','+1-555-0118','DevOps Engineer',   88000.00,'2014-11-20',1,6),
('Megan','Allen','m.allen@company.com','+1-555-0119','Marketing Specialist',65000.00,'2016-05-15',2,8),
('Andrew','King','a.king@company.com','+1-555-0120','Marketing Specialist', 63000.00,'2017-01-10',2,8),
('Brittany','Wright','b.wright@company.com','+1-555-0121','Content Writer', 58000.00,'2018-06-20',2,8),
('Nathan','Scott','n.scott@company.com','+1-555-0122','Sales Representative',55000.00,'2017-03-15',3,9),
('Amber','Green','a.green@company.com','+1-555-0123','Sales Representative', 56000.00,'2017-05-20',3,9),
('Kyle','Baker','k.baker@company.com','+1-555-0124','Senior Sales Rep',      72000.00,'2015-10-01',3,9),
('Crystal','Adams','c.adams@company.com','+1-555-0125','Sales Representative',54000.00,'2019-01-15',3,9),
('Zachary','Nelson','z.nelson@company.com','+1-555-0126','Financial Analyst', 75000.00,'2015-04-10',5,10),
('Heather','Carter','h.carter@company.com','+1-555-0127','Financial Analyst',  73000.00,'2016-07-15',5,10),
('Joshua','Mitchell','j.mitchell@company.com','+1-555-0128','Accountant',      65000.00,'2017-09-20',5,10),
('Amanda','Perez','a.perez@company.com','+1-555-0129','HR Specialist',         60000.00,'2017-11-01',4,11),
('Ryan','Roberts','r.roberts@company.com','+1-555-0130','HR Recruiter',        58000.00,'2018-02-15',4,11);
-- IDs = 12..30
GO

-- ============================================================
-- INSERT PROJECTS
-- ============================================================
INSERT INTO Projects (Name,Description,StartDate,EndDate,Budget,Status,DepartmentID) VALUES
('Cloud Migration Initiative',     'Migrate all legacy systems to cloud',      '2025-01-01','2025-12-31',500000.00,'In Progress',1),
('New CRM Platform',               'Modern CRM for sales team',                '2025-02-15','2025-09-30',250000.00,'In Progress',3),
('Employee Self-Service Portal',   'HR web portal for staff',                  '2025-03-01','2025-07-31',150000.00,'In Progress',4),
('Q2 Marketing Campaign',          'Digital campaign for product launch',      '2025-04-01','2025-06-30', 80000.00,'Completed',  2),
('Financial Reporting Automation', 'Automate quarterly reports',               '2025-01-15','2025-05-30',120000.00,'Completed',  5),
('Mobile App Development',         'Customer-facing mobile application',       '2025-05-01','2026-01-31',350000.00,'In Progress',1),
('Data Analytics Dashboard',       'BI dashboard for executives',              '2024-10-01','2025-03-31',200000.00,'Completed',  1),
('Sales Training Program',         'Sales team upskilling initiative',         '2025-06-01','2025-08-31', 45000.00,'Planning',   3);
GO

-- ============================================================
-- INSERT PROJECT ASSIGNMENTS
-- ============================================================
INSERT INTO ProjectAssignments (ProjectID,EmployeeID,Role,HoursAllocated,StartDate,EndDate) VALUES
-- Cloud Migration (1)
(1, 2,'Project Sponsor',  40,'2025-01-01','2025-12-31'),
(1, 6,'Project Manager', 160,'2025-01-01','2025-12-31'),
(1,12,'Lead Developer',  200,'2025-01-01','2025-12-31'),
(1,13,'Developer',       180,'2025-01-01','2025-12-31'),
(1,14,'Developer',       160,'2025-01-01','2025-12-31'),
(1,18,'DevOps Lead',     200,'2025-01-01','2025-12-31'),
-- New CRM (2)
(2, 3,'Project Sponsor', 30,'2025-02-15','2025-09-30'),
(2, 9,'Project Manager',140,'2025-02-15','2025-09-30'),
(2, 7,'Technical Lead', 120,'2025-02-15','2025-09-30'),
(2,15,'Developer',      160,'2025-02-15','2025-09-30'),
(2,22,'Business Analyst',100,'2025-02-15','2025-09-30'),
-- Employee Portal (3)
(3, 5,'Project Sponsor', 20,'2025-03-01','2025-07-31'),
(3,11,'Project Manager',120,'2025-03-01','2025-07-31'),
(3,16,'Developer',      140,'2025-03-01','2025-07-31'),
(3,17,'QA Engineer',    100,'2025-03-01','2025-07-31'),
(3,29,'HR Consultant',   80,'2025-03-01','2025-07-31'),
-- Q2 Marketing (4)
(4, 3,'Project Sponsor', 20,'2025-04-01','2025-06-30'),
(4, 8,'Project Manager', 80,'2025-04-01','2025-06-30'),
(4,19,'Marketing Lead', 120,'2025-04-01','2025-06-30'),
(4,20,'Content Specialist',100,'2025-04-01','2025-06-30'),
(4,21,'Content Writer',  80,'2025-04-01','2025-06-30'),
-- Financial Reporting (5)
(5, 4,'Project Sponsor', 15,'2025-01-15','2025-05-30'),
(5,10,'Project Manager',100,'2025-01-15','2025-05-30'),
(5,26,'Lead Analyst',   160,'2025-01-15','2025-05-30'),
(5,27,'Analyst',        140,'2025-01-15','2025-05-30'),
(5,28,'Accountant',     100,'2025-01-15','2025-05-30'),
-- Mobile App (6)
(6, 2,'Project Sponsor', 30,'2025-05-01','2026-01-31'),
(6, 7,'Project Manager',160,'2025-05-01','2026-01-31'),
(6,12,'Senior Developer',200,'2025-05-01','2026-01-31'),
(6,13,'Developer',      180,'2025-05-01','2026-01-31'),
(6,17,'QA Engineer',    140,'2025-05-01','2026-01-31'),
(6,16,'Junior Developer',160,'2025-05-01','2026-01-31'),
-- Data Analytics Dashboard (7)
(7, 1,'Project Sponsor', 20,'2024-10-01','2025-03-31'),
(7, 6,'Project Manager',100,'2024-10-01','2025-03-31'),
(7,13,'Lead Developer', 180,'2024-10-01','2025-03-31'),
(7,26,'Data Analyst',   120,'2024-10-01','2025-03-31'),
(7,27,'Data Analyst',   100,'2024-10-01','2025-03-31'),
-- Sales Training (8)
(8, 3,'Project Sponsor', 15,'2025-06-01','2025-08-31'),
(8, 9,'Project Manager', 60,'2025-06-01','2025-08-31'),
(8,29,'HR Coordinator',  80,'2025-06-01','2025-08-31'),
(8,22,'Sales Trainer',  100,'2025-06-01','2025-08-31'),
(8,23,'Sales Trainer',   80,'2025-06-01','2025-08-31');
GO

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'Departments' AS [Table], COUNT(*) AS [Rows] FROM Departments
UNION ALL
SELECT 'Employees',  COUNT(*) FROM Employees
UNION ALL
SELECT 'Projects',   COUNT(*) FROM Projects
UNION ALL
SELECT 'ProjectAssignments', COUNT(*) FROM ProjectAssignments;
GO
