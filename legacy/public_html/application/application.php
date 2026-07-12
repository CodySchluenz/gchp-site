<?php
if (!isset($_SESSION))
{
session_start(); 
}
$message = "error";
?>
<!DOCTYPE html>
<html>
<head>

	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="description" content="The Grant County Holiday Project helps people in need or crisis with basic necessities during the Holiday season. Donations and volunteers are always welcome to assist needy families around the holidays. Money, material goods, time and talent are all appreciated for this worthy cause.">
        
	<title>Grant County Holiday Project helping people in need during the Holiday season</title>
	 <link rel="stylesheet" type="text/css" href="app.css" media="all" /> 

	<!--[if IE]>
	<style type="text/css" media="all">.borderitem {border-style: solid;}</style>
	<![endif]-->
			<style type="text/css">
	body {
	background-color: #003300;  
}


    </style>
</head>

<body>

<div id="main">
<div class="clearFloat"></div>
<div id="header"></div>	
<div class="clearFloat">
<!--///////////////////    MENU BAR BUTTONS  ////////////////////////-->
	<a href="../index.php" class="btn_Home">Home</a>
			<a href="../donate.php" class="btn_Donate">Donate</a>
			<a href="application.php" class="btn_App">Application</a>
			<a href="../contactUs.php" class="btn_ContactUs">Contact Us</a>
			/*<p class="btn_right">&nbsp;</p>*/
			</div>

<div id="widecontent">
	<blockquote><br><br>

<?php
if (!isset($_SESSION))
{
session_start(); 
}
include "../includes/dbConnect.php";

///////////////////////////////Validation Start////////////////////////////
/////////////////////////////// Form 1 Validation /////////////////////////
if(isset($_POST['appPt1']))
{
$message = "";
	if($_POST['fNameTXT'] == "")
	{
	$message = "Please fill in the first Name field";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	unset($_SESSION['app']);
	}
	else if($_POST['lNameTXT'] == "")
	{
	$message = "Please fill in the last Name field";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	unset($_SESSION['app']);
	}
	else if($_POST['addressTXT'] == "")
	{
	$message = "Please fill in the address field";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	unset($_SESSION['app']);
	}
	else if($_POST['citySEL'] == "")
	{
	$message = "Please select the city you live in.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	unset($_SESSION['app']);
	}
	else if($_POST['phoneTXT'] == "")
	{
	$message = "Please fill in your phone number.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	unset($_SESSION['app']);
	}
	else
	{
	$_SESSION['app'] = 1;	
	$message = "";
	}
}
/////////////////////////////// Form 2 Validation /////////////////////////
if(isset($_POST['appPt2'])){
$message = "";
	if($_POST['emp1TXT'] != "" && ($_POST['hWage1TXT'] == "" || $_POST['hWeek1TXT'] == ""))
	{
	$message = "Please finish your first job information.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	$_SESSION['app'] = 1;
	}
	else if ($_POST['emp2TXT'] != "" && ($_POST['hWage2TXT'] == "" || $_POST['hWeek2TXT'] == ""))
	{
	$message = "Please finish your second job information.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	$_SESSION['app'] = 1;
	}
	else if ($_POST['emp3TXT'] != "" && ($_POST['hWage3TXT'] == "" || $_POST['hWeek3TXT'] == ""))
	{
	$message = "Please finish your third job information.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	$_SESSION['app'] = 1;
	}
	
	else if ($_POST['emp4TXT'] != "" && ($_POST['hWage4TXT'] == "" || $_POST['hWeek4TXT'] == ""))
	{
	$message = "Please finish your fourth job information.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	$_SESSION['app'] = 1;
	}
	else
	{
	$_SESSION['app'] = 2;
	$message ="";
	}
}
/////////////////////////////// Form 3 Validation /////////////////////////
if(isset($_POST['appPt3'])){
$message = "";
// no validation required

$_SESSION['app'] = 3;
}
/////////////////////////////// Form 4 Validation /////////////////////////
if(isset($_POST['appPt4'])){

$members = $_POST['children'];
$_SESSION['app'] = 4;
$message = "";

	for($numMem = 1; $numMem <= $members; $numMem++)
	{
		if($message == "")
		{
			if($_POST['nameTXT' .$numMem] == "")
			{
				$message = "Please fill in the child $numMem name field";
				echo "<script type='text/javascript'>alert('".$message."');</script>";
				$_SESSION['app'] = 3;
			}
			else if($_POST['sexRAD' .$numMem] == null)
			{
				$message = "Please select the child $numMem gender";
				echo "<script type='text/javascript'>alert('".$message."');</script>";
				$_SESSION['app'] = 3;
			}
		}
	}

}
/////////////////////////////// Form 5 Validation /////////////////////////
if(isset($_POST['appPt5'])){
$message = "";
if($_POST['deedTXT'] == "")
	{
	$message = "Please fill in a good deed you have done.";
	echo "<script type='text/javascript'>alert('".$message."');</script>";
	$_SESSION['app'] = 4;
	}
else
{
$_SESSION['app'] = 5;
$message == "";
}
}
////////////////////////////Validation End///////////////////////////////////////////
if(isset($_POST['back'])){
	if($_SESSION['app'] == 1)
	{
		unset($_SESSION['app']);
	}
	else
	$_SESSION['app'] = $_SESSION['app'] - 1;
	
}
if(isset($_POST['cancel']))
{
	session_unset();
	session_destroy();
}
if(!isset($_SESSION['app'])){ ?>
	<h1>Grant County Holiday Project Online Application</h1>
	<!-- page content here -->
	<p>If you do not wish to fill out the application online, you may download the <a href="../PDFapplication.pdf" target="_blank">pdf application</a>. Then mail your application</p>
	There are 5 steps to the online application. 
	Fill out each section then click next.</p>
	<p>Please fill in your email address to receive notification your application is accepted or denied.</p>
				
<?php include "applicationForm1.php";
}

if($_SESSION['app'] == 1){
if(!isset($_POST['back']))
{
if($_POST['treeCHK'] =="on")
	$tree = 1;
else
	$tree = 0;
	
if($_POST['diabeticCHK'] =="on")
	$diabetic = 1;
else
	$diabetic = 0;
if($message == "")
	$_SESSION['app1'] = array($_POST['fNameTXT'], $_POST['lNameTXT'], $_POST['addressTXT'], $_POST['citySEL'], $_POST['phoneTXT'], $diabetic, $tree, $_POST['emailTXT'], $_POST['bedCHK'], $_POST['bedSEL']);
}

	echo "<h2>Part 2 - Employer Information</h2>
		  <p>If no one in your household is currently employed, leave the fields blank and click next</p>";
	include "applicationForm2.php";
}

if($_SESSION['app'] == 2){
if(!isset($_POST['back']))
if($message == "")
$_SESSION['app2'] = array($_POST['emp1TXT'], $_POST['hWage1TXT'], $_POST['hWeek1TXT'], 	$_POST['emp2TXT'], $_POST['hWage2TXT'], $_POST['hWeek2TXT'], $_POST['emp3TXT'], $_POST['hWage3TXT'], $_POST['hWeek3TXT'], $_POST['emp4TXT'], $_POST['hWage4TXT'], $_POST['hWeek4TXT']);

	echo "<h2>Part 3 - Benefits</h2>
		  <p>If you currently receive benefits from one of the following, check the box and type in the <strong>monthly</strong> amount you receive.</p>";
	include "applicationForm3.php";

}

if($_SESSION['app'] == 3){

	if($_POST['foodAmt'] == "") 
	$food = 0;
	else $food = $_POST['foodAmt'];
	
	if($_POST['socialAmt'] == "") 
	$socAmt = 0;
	else $socAmt = $_POST['socialAmt'];
	
	if($_POST['ssiAmt'] == "") 
	$ssi = 0;
	else $ssi = $_POST['ssiAmt'];
	
	if($_POST['w2Amt'] == "") 
	$w2 = 0;
	else $w2 = $_POST['w2Amt'];
	
	if($_POST['childAmt'] == "") 
	$child = 0;
	else $child = $_POST['childAmt'];
	
	if($_POST['otherAmt'] == "") 
	$other = 0;
	else $other = $_POST['otherAmt'];	


if(!isset($_POST['back']))
{
	$members = $_POST['numMemSEL'];
	if($message == "")
	$_SESSION['app3'] = array($food, $socAmt, $ssi, $w2, $child, $other, $members);
}
	echo "<h2>Part 4 - Clothing Needs</h2>";
		echo "<p>Please fill out the information for each member. There are enough forms for the number of members you specified in the last step. Make sure to fill in information for yourself as well.</p>";
		include "applicationForm4.php";
	
	
}

if($_SESSION['app'] == 4){
	if(!isset($_POST['back']))
	{

		$members = $_POST['children'];
		if($message == "")
		for($numMem = 1; $numMem <= $members; $numMem++)
		{
			$_SESSION['app4'][$numMem] = array($_POST['nameTXT' .$numMem], $_POST['sexRAD' .$numMem], $_POST['ageSEL' .$numMem], $_POST['sizeTXT1' .$numMem], $_POST['sizeTXT2' .$numMem], $_POST['sizeTXT3' .$numMem], $_POST['sizeTXT4' .$numMem], $_POST['sizeTXT5' .$numMem], $_POST['giftsTXT' .$numMem], $members);
		}
	}
	echo "<h3>Final Step</h3>";
	include "applicationForm5.php";
}

if($_SESSION['app'] == 5){
if(!isset($_POST['back']))
{
	if($message == "")
	$_SESSION['app5'] = array($_POST['deedTXT']);
}

	$today = getdate();
$today = $today['year'] . "/" . $today['mon'] . "/" . $today['mday'];

/////////////////////// insert applicants ///////////////////////
try
	{
		$sql = 'INSERT INTO applicants SET
				fName = :fName,
				lName = :lName,
				address = :address,
				cityID = :cityID,
				phone = :phone,
				diabetic = :diabetic,
				tree = :tree,
				email = :email,
				date = :date,
				bedType = :bedType,
				bedSize = :bedSize';
	$s = $pdo->prepare($sql);
	$s->bindValue(':fName', $_SESSION['app1'][0]);
	$s->bindValue(':lName', $_SESSION['app1'][1]);
	$s->bindValue(':address', $_SESSION['app1'][2]);
	$s->bindValue(':cityID', $_SESSION['app1'][3]);
	$s->bindValue(':phone', $_SESSION['app1'][4]);
	$s->bindValue(':diabetic', $_SESSION['app1'][5]);
	$s->bindValue(':tree',  $_SESSION['app1'][6]);
	$s->bindValue(':email',  $_SESSION['app1'][7]);
	$s->bindValue(':date',  $today);
	$s->bindValue(':bedType',  $_SESSION['app1'][8]);
	$s->bindValue(':bedSize',  $_SESSION['app1'][9]);
	$s->execute();
	
	 $appID = $pdo->lastInsertId();
	
	}
	catch (PDOException $e)
	{
		$error = 'Error adding applicant: ' . $e->getMessage();
		echo $error;
		exit();
	}
/*
try
{


	$sql = 'SELECT LAST_INSERT_ID from applicants';
	$stmt = $sql->query("SELECT LAST_INSERT_ID()");
	$appID = $sql->fetch(PDO::FETCH_NUM);
	$appID = $appID[0];
	
}
catch (PDOException $e)
{
  $error = 'Error fetching applicants id ' . $e->getMessage();
  echo $error;
  exit();
}

*/


///////////////////// insert employers ///////////////////////////////////////

if($_SESSION['app2'][9] != null)
{
	try
	{
		$sql = 'INSERT INTO appEmp SET
				appID = :appID,
				employer1 = :employer1,
				employer2 = :employer2,
				employer3 = :employer3,
				employer4 = :employer4,
				hrsPerWk1 = :hrsPerWk1,
				hrsPerWk2 = :hrsPerWk2,
				hrsPerWk3 = :hrsPerWk3,
				hrsPerWk4 = :hrsPerWk4,
				wage1 = :wage1,
				wage2 = :wage2,
				wage3 = :wage3,
				wage4 = :wage4';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->bindValue(':employer1', $_SESSION['app2'][0]);
	$s->bindValue(':hrsPerWk1', $_SESSION['app2'][2]);
	$s->bindValue(':wage1', $_SESSION['app2'][1]);
	$s->bindValue(':employer2', $_SESSION['app2'][3]);
	$s->bindValue(':hrsPerWk2', $_SESSION['app2'][5]);
	$s->bindValue(':wage2', $_SESSION['app2'][4]);
	$s->bindValue(':employer3',  $_SESSION['app2'][6]);
	$s->bindValue(':hrsPerWk3',  $_SESSION['app2'][8]);
	$s->bindValue(':wage3',  $_SESSION['app2'][7]);
	$s->bindValue(':employer4',  $_SESSION['app2'][9]);
	$s->bindValue(':hrsPerWk4',  $_SESSION['app2'][11]);
	$s->bindValue(':wage4',  $_SESSION['app2'][10]);
	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding employer: ' . $e->getMessage();
		echo $error;
		exit();
	}
}
else if($_SESSION['app2'][6] != null)
{
	try
	{
		$sql = 'INSERT INTO appEmp SET
				appID = :appID,
				employer1 = :employer1,
				employer2 = :employer2,
				employer3 = :employer3,
				hrsPerWk1 = :hrsPerWk1,
				hrsPerWk2 = :hrsPerWk2,
				hrsPerWk3 = :hrsPerWk3,
				wage1 = :wage1,
				wage2 = :wage2,
				wage3 = :wage3';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->bindValue(':employer1', $_SESSION['app2'][0]);
	$s->bindValue(':hrsPerWk1', $_SESSION['app2'][2]);
	$s->bindValue(':wage1', $_SESSION['app2'][1]);
	$s->bindValue(':employer2', $_SESSION['app2'][3]);
	$s->bindValue(':hrsPerWk2', $_SESSION['app2'][5]);
	$s->bindValue(':wage2', $_SESSION['app2'][4]);
	$s->bindValue(':employer3',  $_SESSION['app2'][6]);
	$s->bindValue(':hrsPerWk3',  $_SESSION['app2'][8]);
	$s->bindValue(':wage3',  $_SESSION['app2'][7]);
	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding employer: ' . $e->getMessage();
		echo $error;
		exit();
	}
}
else if($_SESSION['app2'][3] != null)
{
	try
	{
		$sql = 'INSERT INTO appEmp SET
				appID = :appID,
				employer1 = :employer1,
				employer2 = :employer2,
				hrsPerWk1 = :hrsPerWk1,
				hrsPerWk2 = :hrsPerWk2,
				wage1 = :wage1,
				wage2 = :wage2';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->bindValue(':employer1', $_SESSION['app2'][0]);
	$s->bindValue(':hrsPerWk1', $_SESSION['app2'][2]);
	$s->bindValue(':wage1', $_SESSION['app2'][1]);
	$s->bindValue(':employer2', $_SESSION['app2'][3]);
	$s->bindValue(':hrsPerWk2', $_SESSION['app2'][5]);
	$s->bindValue(':wage2', $_SESSION['app2'][4]);
	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding employer: ' . $e->getMessage();
		echo $error;
		exit();
	}
}
else if($_SESSION['app2'][0] != null)
{
	try
	{
		$sql = 'INSERT INTO appEmp SET
				appID = :appID,
				employer1 = :employer1,
				hrsPerWk1 = :hrsPerWk1,
				wage1 = :wage1';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->bindValue(':employer1', $_SESSION['app2'][0]);
	$s->bindValue(':hrsPerWk1', $_SESSION['app2'][2]);
	$s->bindValue(':wage1', $_SESSION['app2'][1]);
	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding employer: ' . $e->getMessage();
		echo $error;
		exit();
	}
}
else
{
	try
	{
		$sql = 'INSERT INTO appEmp SET
				appID = :appID';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding employer: ' . $e->getMessage();
		echo $error;
		exit();
	}
}

/////////////////////// insert benefits ///////////////////////
try
	{
		$sql = 'INSERT INTO benefits SET
				appID = :appID,
				csAmount = :csAmount,
				fsAmount = :fsAmount,
				omAmount = :omAmount,
				socAmount = :socAmount,
				ssiAmount = :ssiAmount,
				w2Amount = :w2Amount';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->bindValue(':fsAmount', $_SESSION['app3'][0]);
	$s->bindValue(':socAmount', $_SESSION['app3'][1]);
	$s->bindValue(':ssiAmount', $_SESSION['app3'][2]);
	$s->bindValue(':w2Amount', $_SESSION['app3'][3]);
	$s->bindValue(':csAmount', $_SESSION['app3'][4]);
	$s->bindValue(':omAmount', $_SESSION['app3'][5]);

	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding benefits: ' . $e->getMessage();
		echo $error;
		exit();
	}


/////////////////////// insert children ///////////////////////
for($numMem = 1; $numMem <= $_SESSION['app4'][1][9]; $numMem++){
try
	{


		$sql = 'INSERT INTO children SET
				appID = :appID,
				name = :name,
				sex = :sex,
				age = :age,
				pantSize = :pantSize,
				shirtSize = :shirtSize,
				undSize = :undSize,
				sockSize = :sockSize,
				diaperSize = :diaperSize,
				gift = :gift';
	$s = $pdo->prepare($sql);

	$s->bindValue(':appID', $appID);
	$s->bindValue(':name', $_SESSION['app4'][$numMem][0]);
	$s->bindValue(':sex', $_SESSION['app4'][$numMem][1]);
	$s->bindValue(':age', $_SESSION['app4'][$numMem][2]);
	$s->bindValue(':pantSize', $_SESSION['app4'][$numMem][3]);
	$s->bindValue(':shirtSize', $_SESSION['app4'][$numMem][4]);
	$s->bindValue(':undSize', $_SESSION['app4'][$numMem][5]);
	$s->bindValue(':sockSize', $_SESSION['app4'][$numMem][6]);
	$s->bindValue(':diaperSize', $_SESSION['app4'][$numMem][7]);
	$s->bindValue(':gift', $_SESSION['app4'][$numMem][8]);

	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding children: ' . $e->getMessage();
		echo $error;
		exit();
	}
}


/////////////////////// insert good deed ///////////////////////
try
	{
		$sql = 'INSERT INTO goodDeed SET
				appID = :appID,
				deedText = :deedText';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $appID);
	$s->bindValue(':deedText', $_SESSION['app5'][0]);

	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding goodDeed: ' . $e->getMessage();
		echo $error;
		exit();
	}
	echo "<p>Your application has been successfully submitted. Thank You.</p>";
	session_unset();
	session_destroy();
}
?>
		<blockquote></div>

<!----------------------  END OF MAIN CONTENT ----------------------------->

	<div class="clearFloat"></div>
<div id="footer"> Grant County Holiday Project | <a href="http://grantcounty.org/" target="_blank">Official Grant Co. Website</a> | <a href="../adminPanel/login.php">Admin</a></div><br><br>
	<div class="clearFloat"></div>
</div>
</body>
</html>