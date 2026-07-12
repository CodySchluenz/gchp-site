<?php
if (!isset($_SESSION))
{
session_start(); 
}
               //tests for valid login    needs to be on every page
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}

include '../../includes/databasesetup.php';

if(isset($_POST['act']) && $_POST['act'] == "Generate Household")
{
	include 'generateHousehold.php';
	exit();
	
}

?>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
	<title>GCHP Management Panel</title>
	<link rel="stylesheet" type="text/css" href="app.css" media="all" />
	<style type="text/css">
	body {
	background-color: #002222;
  
}

 
    </style>
</head>

<body>

<div id="main">
<div id="header"></div>
<div id="clearFloat"><br></div>	
<div class="adminmenu">

	<a href="../index.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME</a>	
	<a href="../donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
	<a href="../applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
	<a href="../sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
	<a href="../pickup/index.php"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>

	<a href="../logout.php" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
</div>
<br><br><br>	
<!-----------------------    MENU BAR    ---------------------->
<!-----------------------  END  MENU    ---------------------->
		
<div id="maincontent">
<!----------------------  MAIN CONTENT TEXT AND CODE GO HERE ----------------------------->
<br>
<blockquote>
<h5>>> Manage Applicants</h5>


<form action="#" method="post" name="applicant">

<?php

try
{
	$sql = 'select * from applicants, cities where applicants.cityID = cities.cityID';
	$result = $pdo->query($sql);
}
catch (PDOException $e)
{
  $error = 'Error fetching Applicants: ' . $e->getMessage();
  echo $error;
  exit();
}


while ($row = $result->fetch())
{
	$applicants[] = array ('appID'=>$row['appID'],
	'reviewed'=>$row['reviewed'],
	'fName'=>$row['fName'],
	'lName'=>$row['lName'],
	'cityID'=>$row['cityID'],
	'cityName'=>$row['cityName'],
	'cityID'=>$row['cityID'],
	'date'=>$row['date'],
	'approved'=>$row['approved']);
}

if(isset($_POST['action']) && $_POST['action'] == "DELETE ALL APPLICANTS")
{
	$endeavor = "Delete all applicants";
	include "confirm.php";
	exit();
}
if(isset($_POST['confirmation']) && $_POST['confirmation'] == "Yes")
{

	try
		{
			$sql = 'TRUNCATE TABLE applicants';
					
		$s = $pdo->prepare($sql);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error clearing applicants table ' . $e->getMessage();
			echo $error;
			exit();
		}

	try
		{
			$sql = 'TRUNCATE TABLE appEmp';
					
		$s = $pdo->prepare($sql);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error clearing appEmp table ' . $e->getMessage();
			echo $error;
			exit();
		}

	try
		{
			$sql = 'TRUNCATE TABLE benefits';
					
		$s = $pdo->prepare($sql);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error clearing benefits table ' . $e->getMessage();
			echo $error;
			exit();
		}

	try
		{
			$sql = 'TRUNCATE TABLE children';
					
		$s = $pdo->prepare($sql);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error clearing children table ' . $e->getMessage();
			echo $error;
			exit();
		}

	try
		{
			$sql = 'TRUNCATE TABLE goodDeed';
					
		$s = $pdo->prepare($sql);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error clearing goodDeed table ' . $e->getMessage();
			echo $error;
			exit();
		}	
}
if(isset($_POST['action']) && $_POST['action'] == "Add Child")
{
	$appID = $_POST['appID'];
	include 'applications/addChild.php';
	exit();
}

if(isset($_POST['action']) && $_POST['action'] == "Add")
{
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

		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':name', $_POST['nameTXT']);
		$s->bindValue(':sex', $_POST['sexRAD']);
		$s->bindValue(':age', $_POST['ageSEL']);
		$s->bindValue(':pantSize', $_POST['sizeTXT1']);
		$s->bindValue(':shirtSize', $_POST['sizeTXT2']);
		$s->bindValue(':undSize', $_POST['sizeTXT3']);
		$s->bindValue(':sockSize', $_POST['sizeTXT4']);
		$s->bindValue(':diaperSize',$_POST['sizeTXT5']);
		$s->bindValue(':gift', $_POST['giftsTXT']);

	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error adding children: ' . $e->getMessage();
		echo $error;
		exit();
	}	
}

if (isset($_POST['act']) && $_POST['act'] == "Update")
{
/////////////////////  update applicant table ///////////////////////
if($_POST['treeCHK'] =="on")
	$tree = 1;
else
	$tree = 0;
	
if($_POST['diabeticCHK'] =="on")
	$diabetic = 1;
else
	$diabetic = 0;
	try
	{
		$sql = 'UPDATE applicants SET
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
				bedSize = :bedSize
				WHERE appID = :appID';
				
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $_POST['appID']);
	$s->bindValue(':fName', $_POST['fNameTXT']);
	$s->bindValue(':lName', $_POST['lNameTXT']);
	$s->bindValue(':address', $_POST['addressTXT']);
	$s->bindValue(':cityID', $_POST['citySEL']);
	$s->bindValue(':phone', $_POST['phoneTXT']);
	$s->bindValue(':diabetic', $diabetic);
	$s->bindValue(':tree',  $tree);
	$s->bindValue(':email',  $_POST['emailTXT']);
	$s->bindValue(':date',  $_POST['date']);
	$s->bindValue(':bedType',  $_POST['bedCHK']);
	$s->bindValue(':bedSize',  $_POST['bedSEL']);
	$s->execute();
	
	}
	catch (PDOException $e)
	{
		$error = 'Error updating applicant: ' . $e->getMessage();
echo $error;
		exit();
	}
	
//////////////////////////  update employer //////////////////	
try
{
	if($_POST['emp4TXT'] != null)
	{
		$sql = 'UPDATE appEmp SET
				employer4 = :employer4,
				hrsPerWk4 = :hrsPerWk4,
				wage4 = :wage4
				WHERE appID = :appID';
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer4',   $_POST['emp4TXT']);
		$s->bindValue(':hrsPerWk4',  $_POST['hWeek4TXT']);
		$s->bindValue(':wage4',  $_POST['hWage4TXT']);
		$s->execute();
	}
	if($_POST['emp3TXT'] != null)
	{
		$sql = 'UPDATE appEmp SET
				employer3 = :employer3,
				hrsPerWk3 = :hrsPerWk3,
				wage3 = :wage3
				WHERE appID = :appID';
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer3', $_POST['emp3TXT']);
		$s->bindValue(':hrsPerWk3',  $_POST['hWeek3TXT']);
		$s->bindValue(':wage3',  $_POST['hWage3TXT']);
		$s->execute();
	}
	if($_POST['emp2TXT'] != null)
	{
		$sql = 'UPDATE appEmp SET
				employer2 = :employer2,
				hrsPerWk2 = :hrsPerWk2,
				wage2 = :wage2
				WHERE appID = :appID';
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer2', $_POST['emp2TXT']);
		$s->bindValue(':hrsPerWk2',  $_POST['hWage2TXT']);
		$s->bindValue(':wage2', $_POST['hWage2TXT']);
		$s->execute();
	}			
	if($_POST['emp1TXT'] != null)
	{
		$sql = 'UPDATE appEmp SET
				employer1 = :employer1,
				hrsPerWk1 = :hrsPerWk1,
				wage1 = :wage1
				WHERE appID = :appID';
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer1', $_POST['emp1TXT']);
		$s->bindValue(':hrsPerWk1', $_POST['hWeek1TXT']);
		$s->bindValue(':wage1', $_POST['hWage1TXT']);
		$s->execute();
	}
	
}
	catch (PDOException $e)
	{
		$error = 'Error updating employer: ' . $e->getMessage();
		echo $error;
		exit();
	}


/////////////// update benefits /////////////////
try
	{
		$sql = 'UPDATE benefits SET
				csAmount = :csAmount,
				fsAmount = :fsAmount,
				omAmount = :omAmount,
				socAmount = :socAmount,
				ssiAmount = :ssiAmount,
				w2Amount = :w2Amount
				WHERE appID = :appID';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $_POST['appID']);
	$s->bindValue(':fsAmount', $_POST['foodAmt']);
	$s->bindValue(':socAmount', $_POST['socialAmt']);
	$s->bindValue(':ssiAmount', $_POST['ssiAmt']);
	$s->bindValue(':w2Amount', $_POST['w2Amt']);
	$s->bindValue(':csAmount', $_POST['childAmt']);
	$s->bindValue(':omAmount', $_POST['otherAmt']);

	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error updating benefits: ' . $e->getMessage();
		echo $error;
		exit();
	}

/////////////////////////////////////////// update children ////////////
	for($numMem = 0; $numMem <= $_POST['children']; $numMem++){
	try
		{
	
			$sql = 'UPDATE children SET
					name = :name,
					sex = :sex,
					age = :age,
					pantSize = :pantSize,
					shirtSize = :shirtSize,
					undSize = :undSize,
					sockSize = :sockSize,
					diaperSize = :diaperSize,
					gift = :gift
					WHERE appID = :appID
					AND childID = :childID';
		$s = $pdo->prepare($sql);
	
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':name', $_POST['nameTXT' .$numMem]);
		$s->bindValue(':sex', $_POST['sexRAD' .$numMem]);
		$s->bindValue(':age', $_POST['ageSEL' .$numMem]);
		$s->bindValue(':pantSize', $_POST['sizeTXT1' .$numMem]);
		$s->bindValue(':shirtSize', $_POST['sizeTXT2' .$numMem]);
		$s->bindValue(':undSize', $_POST['sizeTXT3' .$numMem]);
		$s->bindValue(':sockSize', $_POST['sizeTXT4' .$numMem]);
		$s->bindValue(':diaperSize',$_POST['sizeTXT5' .$numMem]);
		$s->bindValue(':gift', $_POST['giftsTXT' .$numMem]);
		$s->bindValue(':childID', $_POST['childID' .$numMem]);
	
		$s->execute();
		}
		catch (PDOException $e)
		{
			$error = 'Error updating children: ' . $e->getMessage();
			echo $error;
			exit();
		}
	}
	
////////////////////////  update good deed /////////////////////
	try
	{
		$sql = 'UPDATE goodDeed SET
				deedText = :deedText
				WHERE appID = :appID';
	$s = $pdo->prepare($sql);
	$s->bindValue(':appID', $_POST['appID']);
	$s->bindValue(':deedText', $_POST['deedTXT']);

	$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error updating goodDeed: ' . $e->getMessage();
		echo $error;
		exit();
	}
}
/////////////////// end updates //////////////////

///////////////////  admin clicks Approve /////////////////////
if (isset($_POST['act']) && $_POST['act'] == "Approve")
{
	try
		{
			$sql = 'UPDATE applicants SET
					approved = :approved,
					reviewed = :reviewed
					WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':approved', 1);
		$s->bindValue(':reviewed', 1);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error approving applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	if (filter_var($_POST['emailTXT'], FILTER_VALIDATE_EMAIL)) 
	{
		$email = $_POST['emailTXT'];
		$subject = "Grant County Holiday Project Application";
		$message = "Your Application for the Grant County Holiday Project has been Approved";
		$from = "skleinow@co.grant.wi.gov";
		
    		mail($email,$subject,$message,"From: $from\n");
    		
    		echo "<div style='font-size:x-large;'>Application Accepted, and email has been sent.</div>";
	}
	else
	{
		echo "Application Accepted, but email was not sent.";
	}
	include 'redirect.php';
}

///////////// admin clicks Deny ////////////////////
if (isset($_POST['act']) && $_POST['act'] == "Deny")
{
	try
		{
			$sql = 'UPDATE applicants SET
					approved = :denied,
					reviewed = :reviewed
					WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':denied', 0);
		$s->bindValue(':reviewed', 1);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error denying applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	include 'redirect.php';
}

/////////////// admin clicks on delete child ////////////////////
if(isset($_POST['delete']))
{
	$member = substr($_POST['delete'] , 14 , 2);
	$member = $member - 1;
	try
		{
			$sql = 'DELETE FROM children WHERE childID = :childID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':childID', $_POST['childID' . $member]);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting child: ' . $e->getMessage();
			echo $error;
			exit();
		}
}

////////////////// admin clicks on delete employer ///////////////////

if(isset($_POST['deleteEmp1']))
{
	$blank = null;
	try
		{
			$sql = 'UPDATE appEmp SET
					employer1 = :employer1,
					wage1 = :wage1,
					hrsPerWk1 = :hrsPerWk1
					WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer1', $blank);
		$s->bindValue(':wage1', $blank);
		$s->bindValue(':hrsPerWk1', $blank);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting employer: ' . $e->getMessage();
			echo $error;
			exit();
		}
}

if(isset($_POST['deleteEmp2']))
{
	$blank = null;
	try
		{
			$sql = 'UPDATE appEmp SET
					employer2 = :employer2,
					wage2 = :wage2,
					hrsPerWk2 = :hrsPerWk2
					WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer2', $blank);
		$s->bindValue(':wage2', $blank);
		$s->bindValue(':hrsPerWk2', $blank);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting employer: ' . $e->getMessage();
			echo $error;
			exit();
		}
}

if(isset($_POST['deleteEmp3']))
{
	$blank = null;
	try
		{
			$sql = 'UPDATE appEmp SET
					employer3 = :employer3,
					wage3 = :wage3,
					hrsPerWk3 = :hrsPerWk3
					WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer3', $blank);
		$s->bindValue(':wage3', $blank);
		$s->bindValue(':hrsPerWk3', $blank);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting employer: ' . $e->getMessage();
			echo $error;
			exit();
		}
}

if(isset($_POST['deleteEmp4']))
{
	$blank = null;
	try
		{
			$sql = 'UPDATE appEmp SET
					employer4 = :employer4,
					wage4 = :wage4,
					hrsPerWk4 = :hrsPerWk4
					WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->bindValue(':employer4', $blank);
		$s->bindValue(':wage4', $blank);
		$s->bindValue(':hrsPerWk4', $blank);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting employer: ' . $e->getMessage();
			echo $error;
			exit();
		}
}

/////////////////// admin clicks delete applicant /////////////////////
if(isset($_POST['act']) && $_POST['act'] == "DELETE Applicant")
{
	try
		{
			$sql = 'DELETE FROM applicants WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	try
		{
			$sql = 'DELETE FROM appEmp WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	try
		{
			$sql = 'DELETE FROM benefits WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	try
		{
			$sql = 'DELETE FROM children WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	try
		{
			$sql = 'DELETE FROM goodDeed WHERE appID = :appID';
					
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->execute();
		
		}
		catch (PDOException $e)
		{
			$error = 'Error deleting applicant: ' . $e->getMessage();
			echo $error;
			exit();
		}
	
	
}



////////////////// admin clicks Edit ///////////////////////
if (isset($_POST['action']) && $_POST['action'] == "Edit")
{
	$appID = $_POST['appID'];
	try
	{

		$sql = 'SELECT * FROM applicants, appEmp, benefits, children, goodDeed WHERE applicants.appID = :appID AND appEmp.appID = :appID AND benefits.appID = :appID AND children.appID = :appID AND goodDeed.appID = :appID';
		
		$s = $pdo->prepare($sql);
		$s->bindValue(':appID', $_POST['appID']);
		$s->execute();
	}
	catch (PDOException $e)
	{
		$error = 'Error selecting Applicant for editing: ' . $e->getMessage();
		echo $error;
		exit();
	}
	$info = $s->fetch();
	echo $info['deedTXT'];
	include 'applications/applicationForm1.php';
	include 'applications/applicationForm2.php';
	include 'applications/applicationForm3.php';
	include 'applications/applicationForm4.php';
	include 'applications/applicationForm5.php';
	exit();

}

?>

</form>
<blockquote>
		
<div class="panelTable">
		<table width="100%" >
		<tr>
		<td>Reviewed</td><td>Last Name</td><td>First Name</td><td>City</td><td>Date of Application</td><td>Approved</td><td>Edit</td>
		</tr>

<?php
if($applicants != null)
{
foreach($applicants as $applicant): ?>
		<tr>
		<td><input type='checkbox' <?php if($applicant['reviewed'] == 1) echo "checked"; ?> disabled /> </td>
		<td><?php echo $applicant['lName']?></td>
		<td><?php echo $applicant['fName']?></td>
		<td><?php echo $applicant['cityName']?></td>
		<td><?php echo $applicant['date']?></td>
		<td><input type='checkbox' <?php if($applicant['approved'] == 1) echo "checked"; ?> disabled /> </td>
		<form method="post" action="#">
		<td width="8%"><input type='hidden' name='appID' value="<?php echo $applicant['appID'];?>" />
		<input class="btn-app" type='submit' name='action' value='Edit' /> </td>
		</form>
</tr>

<?php endforeach;
}
else
	echo "There are 0 applicants. =(";
?>
</table>
</div>	
<form action="#" method="post" name="deleteAll"><br>
<input class="btn-style" type='submit' name='action' value='DELETE ALL APPLICANTS' />
</form>
<br /><br /><br /><br /><br /><br />
</blockquote>
</div>
<br /><br /><br /><br /><br /><br />
<!----------------------  MAIN CONTENT ENDS ----------------------------->

	<div class="clearFloat"></div>
	<div id="footer">Admin Management Panel</div>
	<div class="clearFloat"></div>
</div>
</body>
</html>