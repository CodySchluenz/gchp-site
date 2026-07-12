-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 12, 2026 at 01:21 PM
-- Server version: 5.7.23-23
-- PHP Version: 8.1.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `grantco3_holidayProject`
--
CREATE DATABASE IF NOT EXISTS `grantco3_holidayProject` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `grantco3_holidayProject`;

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `username` varchar(50) NOT NULL,
  `password` varchar(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `admin`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `appEmp`
--

CREATE TABLE `appEmp` (
  `appID` int(11) NOT NULL,
  `employer1` varchar(100) DEFAULT NULL,
  `wage1` decimal(10,2) DEFAULT NULL,
  `hrsPerWk1` int(11) DEFAULT NULL,
  `employer2` varchar(100) DEFAULT NULL,
  `wage2` decimal(10,2) DEFAULT NULL,
  `hrsPerWk2` int(11) DEFAULT NULL,
  `employer3` varchar(100) DEFAULT NULL,
  `wage3` decimal(10,2) DEFAULT NULL,
  `hrsPerWk3` int(11) DEFAULT NULL,
  `employer4` varchar(100) DEFAULT NULL,
  `wage4` decimal(10,2) DEFAULT NULL,
  `hrsPerWk4` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `appEmp`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `applicants`
--

CREATE TABLE `applicants` (
  `appID` int(11) NOT NULL,
  `fName` varchar(50) DEFAULT NULL,
  `lName` varchar(50) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `cityID` int(11) NOT NULL,
  `tree` tinyint(1) DEFAULT NULL,
  `diabetic` tinyint(1) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `date` varchar(10) DEFAULT NULL,
  `approved` varchar(11) DEFAULT '0',
  `reviewed` varchar(11) DEFAULT '0',
  `bedType` varchar(10) DEFAULT NULL,
  `bedSize` varchar(10) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `applicants`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `bar`
--

CREATE TABLE `bar` (
  `sbID` int(11) NOT NULL,
  `title` text NOT NULL,
  `subtitle` text NOT NULL,
  `para` text NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `bar`
--

INSERT INTO `bar` (`sbID`, `title`, `subtitle`, `para`) VALUES
(50, '2025 Info', ' Pick up times', 'Our site and mailing address is 245 W. Elm St. Lancaster WI. 53813. Again this year there will only be 1-day pick up available for all towns except Boscobel and Platteville will have 2 days. Dates will be listed on pick up slips. Must have Pick-Pay slip to receive items. Pay forward is still required for program eligibility. You will need to give of yourself to others in your community. (No Relatives) Giving does not mean giving money but providing simple acts of kindness. You will receive a form to list your good deeds. Return form along with your Holiday Project application. Kindness is needed year-round.\r\n          \r\n     '),
(49, 'Special Gifts List', 'No guarantee you will receive', 'silverware, hair dryer, drawing kit, smart watch, wireless speaker, turbo scrubber, 12 cup coffee maker, 30 pc marker set, frying pan set,Baking pan set, 4 slice toaster, electric griddle, 2 red sofa pillows, reg bed pillows, fishing pole in carrier, crockpot, cookware set, screw driver set, hand mixer, air fryer                      '),
(52, ' Applications', 'Application start October 1 of each project year', ' You can apply here online or others not computer knowledgeable can call 608-723-2136 ex 1194 and request paper application. Speak slowly leave name, address and if family or elderly household. This is message line only. Return application ASAP.                    ');

-- --------------------------------------------------------

--
-- Table structure for table `benefits`
--

CREATE TABLE `benefits` (
  `appID` int(11) NOT NULL,
  `fsAmount` decimal(10,2) DEFAULT NULL,
  `ssiAmount` decimal(10,2) DEFAULT NULL,
  `w2Amount` decimal(10,2) DEFAULT NULL,
  `csAmount` decimal(10,2) DEFAULT NULL,
  `omAmount` decimal(10,2) DEFAULT NULL,
  `socAmount` decimal(10,2) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `benefits`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `children`
--

CREATE TABLE `children` (
  `appID` int(11) DEFAULT NULL,
  `childID` int(11) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `sex` char(1) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `pantSize` varchar(20) DEFAULT NULL,
  `shirtSize` varchar(20) DEFAULT NULL,
  `undSize` varchar(20) DEFAULT NULL,
  `sockSize` varchar(20) DEFAULT NULL,
  `diaperSize` varchar(20) DEFAULT NULL,
  `gift` varchar(255) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `children`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `cities`
--

CREATE TABLE `cities` (
  `cityID` int(11) NOT NULL,
  `cityName` varchar(50) DEFAULT NULL,
  `cityZip` char(5) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `cities`
--

INSERT INTO `cities` (`cityID`, `cityName`, `cityZip`) VALUES
(1, 'Bagley', '53801'),
(2, 'Beetown', '53802'),
(3, 'Bloomington', '53804'),
(4, 'Blue River', '53518'),
(5, 'Boscobel', '53805'),
(6, 'Cassville', '53806'),
(7, 'Cuba City', '53807'),
(8, 'Dickeyville', '53808'),
(9, 'Fennimore', '53809'),
(10, 'Glen Haven', '53810'),
(11, 'Hazel Green', '53811'),
(12, 'Kieler', '53812'),
(13, 'Lancaster', '53813'),
(14, 'Livingston', '53554'),
(15, 'Montfort', '53569'),
(16, 'Mount Hope', '53816'),
(17, 'Muscoda', '53573'),
(18, 'Patch Grove', '53817'),
(19, 'Platteville', '53818'),
(20, 'Potosi', '53820'),
(22, 'Stitzer', '53824'),
(23, 'Woodman', '53827'),
(24, 'Prairie du Chien', '53821');

-- --------------------------------------------------------

--
-- Table structure for table `donations`
--

CREATE TABLE `donations` (
  `donationID` int(11) NOT NULL,
  `donID` int(11) NOT NULL,
  `itemDon` varchar(100) DEFAULT NULL,
  `monDon` decimal(50,2) DEFAULT NULL,
  `date` varchar(10) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `donor`
--

CREATE TABLE `donor` (
  `donID` int(11) NOT NULL,
  `donName` varchar(100) DEFAULT NULL,
  `donContact` varchar(100) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `state` char(2) DEFAULT NULL,
  `zip` char(5) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `donor`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `goodDeed`
--

CREATE TABLE `goodDeed` (
  `appID` int(11) NOT NULL,
  `deedText` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `goodDeed`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `pickup`
--

CREATE TABLE `pickup` (
  `ParaNum` int(11) NOT NULL,
  `ParaText` text NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `pickup`
--

INSERT INTO `pickup` (`ParaNum`, `ParaText`) VALUES
(2, 'NOTICE: New pickup times. If not able, have someone else pick your items. You can only pick up your items if you have received a pickup slip by mail or email. Bring your pickup slip. Your items will be available on the original pickup date. Not before. If you aren\'t able on your date, you can pick up the next scheduled date listed below. After Tuesday Dec 16th items will be placed back in inventory. 																																																														'),
(3, 'Tuesday Dec 2nd																																																																		'),
(4, 'Pick up Addresses: Lancaster, Beetown, Prairie du Chien, Glen Haven, Mt. Hope, Patch Grove, Bloomington, Potosi, and Cassville	Pickup time 11 AM-2:30 PM		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		 		'),
(5, 'Wednesday Dec 3rd																													'),
(7, 'Monday Dec 8th																																																																					'),
(8, 'Pick up Addresses: Platteville, Hazel Green, Cuba City, Dickeyville and Kieler \r\n      		Pickup time 11 AM-3:30 PM		'),
(9, 'Tuesday Dec 9th																													'),
(10, ' Pick up Addresses: Platteville, Hazel Green, Cuba City, Dickeyville and Kieler \r\n Pickup time 11 AM-3:30 PM																																																																			'),
(11, 'Wednesday Dec 10th\r\n																																																																				'),
(12, 'Pick up Addresses as follows: Boscobel	Pickup time 11 AM-3:30 PM\r\n           																																																												'),
(13, 'Thursday Dec 11th'),
(14, 'Pick up Addresses as follows: Boscobel	Pickup time 11 AM-3:30 PM'),
(15, 'Monday Dec 15th																		'),
(16, 'Stragglers Those who have not picked up and applied late\r\n     	Pickup time 11 AM-2:30 PM																																																																	'),
(17, 'Tuesday Dec 16th																		'),
(18, 'Stragglers Those who have not picked up and applied late\r\n         	Pickup time 11 AM-2:30 PM																																																																	'),
(19, '																																																																		'),
(20, '	Items not picked up by Dec 16th will be put back in inventory and unavailable																																																									'),
(21, '																																																																			'),
(22, ''),
(1, '2025 Pickup Schedule   Return to 1-day pick-ups. Pick-up time 11 AM-2:30 PM Except Boscobel Platteville 11-3:30																																																																						'),
(6, 'Pick up Addresses: Woodman, Stitzer, Montfort, Blue River, Fennimore, Livingston, Muscoda and Bagley Pickup time 11 AM-2:30 PM');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`username`);

--
-- Indexes for table `appEmp`
--
ALTER TABLE `appEmp`
  ADD PRIMARY KEY (`appID`),
  ADD UNIQUE KEY `appID_2` (`appID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `applicants`
--
ALTER TABLE `applicants`
  ADD PRIMARY KEY (`appID`);

--
-- Indexes for table `bar`
--
ALTER TABLE `bar`
  ADD PRIMARY KEY (`sbID`);

--
-- Indexes for table `benefits`
--
ALTER TABLE `benefits`
  ADD PRIMARY KEY (`appID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `children`
--
ALTER TABLE `children`
  ADD PRIMARY KEY (`childID`);

--
-- Indexes for table `cities`
--
ALTER TABLE `cities`
  ADD PRIMARY KEY (`cityID`);

--
-- Indexes for table `donations`
--
ALTER TABLE `donations`
  ADD PRIMARY KEY (`donationID`),
  ADD KEY `donID` (`donID`);

--
-- Indexes for table `donor`
--
ALTER TABLE `donor`
  ADD PRIMARY KEY (`donID`);

--
-- Indexes for table `goodDeed`
--
ALTER TABLE `goodDeed`
  ADD PRIMARY KEY (`appID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `pickup`
--
ALTER TABLE `pickup`
  ADD UNIQUE KEY `ParaNum` (`ParaNum`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `applicants`
--
ALTER TABLE `applicants`
  MODIFY `appID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=259;

--
-- AUTO_INCREMENT for table `bar`
--
ALTER TABLE `bar`
  MODIFY `sbID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `children`
--
ALTER TABLE `children`
  MODIFY `childID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=911;

--
-- AUTO_INCREMENT for table `donations`
--
ALTER TABLE `donations`
  MODIFY `donationID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `donor`
--
ALTER TABLE `donor`
  MODIFY `donID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;
--
-- Database: `grantco3_hproject`
--
CREATE DATABASE IF NOT EXISTS `grantco3_hproject` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `grantco3_hproject`;

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `username` varchar(50) NOT NULL,
  `password` varchar(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `admin`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `appben`
--

CREATE TABLE `appben` (
  `appID` int(11) NOT NULL,
  `benID` int(11) NOT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `appBenID` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `appben`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `appemp`
--

CREATE TABLE `appemp` (
  `appID` char(7) DEFAULT NULL,
  `empName` varchar(100) DEFAULT NULL,
  `hWage` decimal(10,2) DEFAULT NULL,
  `hWeek` int(11) DEFAULT NULL,
  `appEmpID` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `appemp`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `applicants`
--

CREATE TABLE `applicants` (
  `fName` varchar(50) DEFAULT NULL,
  `lName` varchar(50) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `cityID` int(11) DEFAULT NULL,
  `tree` tinyint(1) DEFAULT NULL,
  `diabetic` tinyint(1) DEFAULT NULL,
  `phone` varchar(10) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `appID` int(11) NOT NULL,
  `password` varchar(50) DEFAULT NULL,
  `approved` varchar(11) DEFAULT '0',
  `reviewed` varchar(11) DEFAULT '0',
  `bedType` varchar(10) DEFAULT NULL,
  `bedSize` varchar(10) DEFAULT NULL,
  `exported` int(1) DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `applicants`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `benefits`
--

CREATE TABLE `benefits` (
  `benID` int(11) NOT NULL,
  `benName` varchar(25) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `benefits`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `children`
--

CREATE TABLE `children` (
  `childID` int(11) NOT NULL,
  `appID` int(11) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `sex` char(1) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `pantSize` varchar(20) DEFAULT NULL,
  `shirtSize` varchar(20) DEFAULT NULL,
  `undSize` varchar(20) DEFAULT NULL,
  `sockSize` varchar(20) DEFAULT NULL,
  `shoeSize` varchar(20) DEFAULT NULL,
  `gift` varchar(255) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `children`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `citycode`
--

CREATE TABLE `citycode` (
  `cityID` int(11) NOT NULL,
  `cityName` varchar(50) DEFAULT NULL,
  `zip` char(5) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `citycode`
--

INSERT INTO `citycode` (`cityID`, `cityName`, `zip`) VALUES
(1, 'Bagley', '53801'),
(2, 'Beetown', '53802'),
(3, 'Bloomington', '53804'),
(4, 'Blue River', '53518'),
(5, 'Boscobel', '53805'),
(6, 'Cassville', '53806'),
(7, 'Cuba City', '53807'),
(8, 'Dickeyville', '53808'),
(9, 'Fennimore', '53809'),
(10, 'Glen Haven', '53810'),
(11, 'Hazel Green', '53811'),
(12, 'Kieler', '53812'),
(13, 'Lancaster', '53813'),
(14, 'Livingston', '53554'),
(15, 'Montfort', '53569'),
(16, 'Mount Hope', '53816'),
(17, 'Muscoda', '53573'),
(18, 'Patch Grove', '53817'),
(19, 'Platteville', '53818'),
(20, 'Potosi', '53820'),
(22, 'Stitzer', '53824'),
(23, 'Woodman', '53827'),
(24, 'Prairie du Chien', '53821');

-- --------------------------------------------------------

--
-- Table structure for table `deed`
--

CREATE TABLE `deed` (
  `deedID` int(11) NOT NULL,
  `appID` int(11) NOT NULL,
  `deedText` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `deed`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `donations`
--

CREATE TABLE `donations` (
  `donationID` int(11) NOT NULL,
  `donID` int(11) NOT NULL,
  `itemDon` varchar(100) DEFAULT NULL,
  `monDon` decimal(50,2) DEFAULT NULL,
  `date` varchar(10) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `donator`
--

CREATE TABLE `donator` (
  `donID` int(11) NOT NULL,
  `donName` varchar(100) DEFAULT NULL,
  `donContact` varchar(100) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `state` char(2) DEFAULT NULL,
  `zip` char(5) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `sidebar`
--

CREATE TABLE `sidebar` (
  `ParaNum` int(11) NOT NULL,
  `ParaText` text NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `sidebar`
--

INSERT INTO `sidebar` (`ParaNum`, `ParaText`) VALUES
(1, 'Latest News\r\n'),
(8, 'All applications and forms are available. Either download the pdfs or fill out and submit online'),
(9, 'here'),
(10, 'Pay It Forward'),
(11, 'Pay forward is required to receive benefit from Holiday Project.'),
(2, '2013 Pick-Up Schedule'),
(5, 'Read more'),
(6, 'Online applications'),
(7, 'October 1 of each project year'),
(3, 'Dec 2nd, 2013'),
(4, 'We have released our pick-up schedule for the 2013 holiday season. To view the schedule please click read more below.'),
(12, 'Read more');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`username`);

--
-- Indexes for table `appben`
--
ALTER TABLE `appben`
  ADD UNIQUE KEY `appBenID` (`appBenID`);

--
-- Indexes for table `appemp`
--
ALTER TABLE `appemp`
  ADD PRIMARY KEY (`appEmpID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `applicants`
--
ALTER TABLE `applicants`
  ADD PRIMARY KEY (`appID`),
  ADD KEY `cityID` (`cityID`);

--
-- Indexes for table `benefits`
--
ALTER TABLE `benefits`
  ADD PRIMARY KEY (`benID`);

--
-- Indexes for table `children`
--
ALTER TABLE `children`
  ADD PRIMARY KEY (`childID`),
  ADD UNIQUE KEY `childID` (`childID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `citycode`
--
ALTER TABLE `citycode`
  ADD PRIMARY KEY (`cityID`);

--
-- Indexes for table `deed`
--
ALTER TABLE `deed`
  ADD PRIMARY KEY (`deedID`),
  ADD UNIQUE KEY `deedID` (`deedID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `donations`
--
ALTER TABLE `donations`
  ADD PRIMARY KEY (`donationID`),
  ADD KEY `donID` (`donID`);

--
-- Indexes for table `donator`
--
ALTER TABLE `donator`
  ADD PRIMARY KEY (`donID`);

--
-- Indexes for table `sidebar`
--
ALTER TABLE `sidebar`
  ADD PRIMARY KEY (`ParaNum`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `appben`
--
ALTER TABLE `appben`
  MODIFY `appBenID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=723;

--
-- AUTO_INCREMENT for table `appemp`
--
ALTER TABLE `appemp`
  MODIFY `appEmpID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=452;

--
-- AUTO_INCREMENT for table `applicants`
--
ALTER TABLE `applicants`
  MODIFY `appID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=511;

--
-- AUTO_INCREMENT for table `benefits`
--
ALTER TABLE `benefits`
  MODIFY `benID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `children`
--
ALTER TABLE `children`
  MODIFY `childID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1395;

--
-- AUTO_INCREMENT for table `deed`
--
ALTER TABLE `deed`
  MODIFY `deedID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=104;

--
-- AUTO_INCREMENT for table `donations`
--
ALTER TABLE `donations`
  MODIFY `donationID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `donator`
--
ALTER TABLE `donator`
  MODIFY `donID` int(11) NOT NULL AUTO_INCREMENT;
--
-- Database: `grantco3_testing`
--
CREATE DATABASE IF NOT EXISTS `grantco3_testing` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `grantco3_testing`;

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `username` varchar(50) NOT NULL,
  `password` varchar(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `admin`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `appben`
--

CREATE TABLE `appben` (
  `appID` int(11) NOT NULL,
  `benID` int(11) NOT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `appBenID` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `appben`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `appemp`
--

CREATE TABLE `appemp` (
  `appID` char(7) DEFAULT NULL,
  `empName` varchar(100) DEFAULT NULL,
  `hWage` decimal(10,2) DEFAULT NULL,
  `hWeek` int(11) DEFAULT NULL,
  `appEmpID` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `appemp`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `applicants`
--

CREATE TABLE `applicants` (
  `fName` varchar(50) DEFAULT NULL,
  `lName` varchar(50) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `cityID` int(11) DEFAULT NULL,
  `tree` tinyint(1) DEFAULT NULL,
  `diabetic` tinyint(1) DEFAULT NULL,
  `phone` varchar(10) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `appID` int(11) NOT NULL,
  `password` varchar(50) DEFAULT NULL,
  `approved` varchar(11) DEFAULT '0',
  `reviewed` varchar(11) DEFAULT '0',
  `bedType` varchar(10) DEFAULT NULL,
  `bedSize` varchar(10) DEFAULT NULL,
  `exported` int(1) DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `applicants`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `benefits`
--

CREATE TABLE `benefits` (
  `benID` int(11) NOT NULL,
  `benName` varchar(25) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `benefits`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `children`
--

CREATE TABLE `children` (
  `childID` int(11) NOT NULL,
  `appID` int(11) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `sex` char(1) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `pantSize` varchar(20) DEFAULT NULL,
  `shirtSize` varchar(20) DEFAULT NULL,
  `undSize` varchar(20) DEFAULT NULL,
  `sockSize` varchar(20) DEFAULT NULL,
  `shoeSize` varchar(20) DEFAULT NULL,
  `gift` varchar(255) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `children`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- --------------------------------------------------------

--
-- Table structure for table `citycode`
--

CREATE TABLE `citycode` (
  `cityID` int(11) NOT NULL,
  `cityName` varchar(50) DEFAULT NULL,
  `zip` char(5) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `citycode`
--

INSERT INTO `citycode` (`cityID`, `cityName`, `zip`) VALUES
(1, 'Bagley', '53801'),
(2, 'Beetown', '53802'),
(3, 'Bloomington', '53804'),
(4, 'Blue River', '53518'),
(5, 'Boscobel', '53805'),
(6, 'Cassville', '53806'),
(7, 'Cuba City', '53807'),
(8, 'Dickeyville', '53808'),
(9, 'Fennimore', '53809'),
(10, 'Glen Haven', '53810'),
(11, 'Hazel Green', '53811'),
(12, 'Kieler', '53812'),
(13, 'Lancaster', '53813'),
(14, 'Livingston', '53554'),
(15, 'Montfort', '53569'),
(16, 'Mount Hope', '53816'),
(17, 'Muscoda', '53573'),
(18, 'Patch Grove', '53817'),
(19, 'Platteville', '53818'),
(20, 'Potosi', '53820'),
(21, 'Sinsinawa', '53824'),
(22, 'Stitzer', '53824'),
(23, 'Woodman', '53827'),
(24, 'Prairie du Chien', '53821');

-- --------------------------------------------------------

--
-- Table structure for table `donations`
--

CREATE TABLE `donations` (
  `donationID` int(11) NOT NULL,
  `donID` int(11) NOT NULL,
  `itemDon` varchar(100) DEFAULT NULL,
  `monDon` decimal(50,2) DEFAULT NULL,
  `date` varchar(10) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `donator`
--

CREATE TABLE `donator` (
  `donID` int(11) NOT NULL,
  `donName` varchar(100) DEFAULT NULL,
  `donContact` varchar(100) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `state` char(2) DEFAULT NULL,
  `zip` char(5) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Dumping data for table `donator`
--

-- (data rows removed 2026-07-12: contained applicant PII and/or credentials)

-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`username`);

--
-- Indexes for table `appben`
--
ALTER TABLE `appben`
  ADD UNIQUE KEY `appBenID` (`appBenID`);

--
-- Indexes for table `appemp`
--
ALTER TABLE `appemp`
  ADD PRIMARY KEY (`appEmpID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `applicants`
--
ALTER TABLE `applicants`
  ADD PRIMARY KEY (`appID`),
  ADD KEY `cityID` (`cityID`);

--
-- Indexes for table `benefits`
--
ALTER TABLE `benefits`
  ADD PRIMARY KEY (`benID`);

--
-- Indexes for table `children`
--
ALTER TABLE `children`
  ADD PRIMARY KEY (`childID`),
  ADD UNIQUE KEY `childID` (`childID`),
  ADD KEY `appID` (`appID`);

--
-- Indexes for table `citycode`
--
ALTER TABLE `citycode`
  ADD PRIMARY KEY (`cityID`);

--
-- Indexes for table `donations`
--
ALTER TABLE `donations`
  ADD PRIMARY KEY (`donationID`),
  ADD KEY `donID` (`donID`);

--
-- Indexes for table `donator`
--
ALTER TABLE `donator`
  ADD PRIMARY KEY (`donID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `appben`
--
ALTER TABLE `appben`
  MODIFY `appBenID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=191;

--
-- AUTO_INCREMENT for table `appemp`
--
ALTER TABLE `appemp`
  MODIFY `appEmpID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=203;

--
-- AUTO_INCREMENT for table `applicants`
--
ALTER TABLE `applicants`
  MODIFY `appID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=170;

--
-- AUTO_INCREMENT for table `benefits`
--
ALTER TABLE `benefits`
  MODIFY `benID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `children`
--
ALTER TABLE `children`
  MODIFY `childID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=412;

--
-- AUTO_INCREMENT for table `donations`
--
ALTER TABLE `donations`
  MODIFY `donationID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `donator`
--
ALTER TABLE `donator`
  MODIFY `donID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=154;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
