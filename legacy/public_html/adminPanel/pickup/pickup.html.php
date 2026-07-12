<?php
               //tests for valid login    needs to be on every page
if (!isset($_SESSION))
{
session_start(); 
}
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}

?>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
		<title>GCHP Management Panel</title>
	<link rel="stylesheet" type="text/css" href="pickup.css" media="all" />
	<!--[if IE]>
	<style type="text/css" media="all">.borderitem {border-style: solid;}</style>
	<![endif]-->
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

<br>
		
<div id="maincontent">
<!----------------------  MAIN CONTENT TEXT AND CODE GO HERE ----------------------------->
<blockquote><br><br>
<form  action="?edit" method="POST" name="updateForm">
<table>

<tr>

<td width="80%"><h5>Below is what the public will view when they click "VIEW PICKUP SCHEDULE" on the front page.<br><br></h5></td>

<td width="20%"><input class="btn-style1" type="submit" name="action" value="Update The Pickup Schedule" /><br><br></td>

</tr>
</table>
</form>
<div class="panelTable">
<table>

<tr><td  colspan="3"><?php

include "../../includes/databasesetup.php";

$para1 = "SELECT ParaText FROM pickup WHERE ParaNum = 1"; 
		
		$s1 = $pdo->prepare($para1);
		$s1->execute();	
		
		$row =  $s1->fetch();
			$p1 = $row['ParaText'];		
					
		echo "<h2>$p1</h2>";
			
			

		
		
?></td></tr>		

<?php

$para2 = "SELECT ParaText FROM pickup WHERE ParaNum = 2";

		$s2 = $pdo->prepare($para2);
		$s2->execute();	
		
		$row =  $s2->fetch();
			$p2 = $row['ParaText'];		
					
		echo "<tr><td colspan='2'><h2 style='text-align: left;'>$p2</h2></td></tr>";


$para3 = "SELECT ParaText FROM pickup WHERE ParaNum = 3";

		$s3 = $pdo->prepare($para3);
		$s3->execute();	
		
		$row =  $s3->fetch();
			$p3 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p3</h5></td>";
			
$para4 = "SELECT ParaText FROM pickup WHERE ParaNum = 4";

		$s4 = $pdo->prepare($para4);
		$s4->execute();	
		
		$row =  $s4->fetch();
			$p4 = $row['ParaText'];		
					
		echo "<td><h5>$p4</h5></td></tr>";



		
$para5 = "SELECT ParaText FROM pickup WHERE ParaNum = 5";

		$s5 = $pdo->prepare($para5);
		$s5->execute();	
		
		$row =  $s5->fetch();
			$p5 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p5</h5></td>";
			
$para6 = "SELECT ParaText FROM pickup WHERE ParaNum = 6";

		$s6 = $pdo->prepare($para6);
		$s6->execute();	
		
		$row =  $s6->fetch();
			$p6 = $row['ParaText'];		
					
		echo "<td><h5>$p6</h5></td></tr>";



			
$para7 = "SELECT ParaText FROM pickup WHERE ParaNum = 7";

		$s7 = $pdo->prepare($para7);
		$s7->execute();	
		
		$row =  $s7->fetch();
			$p7 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p7</h5></td>";
			
$para8 = "SELECT ParaText FROM pickup WHERE ParaNum = 8";

		$s8 = $pdo->prepare($para8);
		$s8->execute();	
		
		$row =  $s8->fetch();
			$p8 = $row['ParaText'];		
					
		echo "<td><h5>$p8</h5></td></tr>";




			
$para9 = "SELECT ParaText FROM pickup WHERE ParaNum = 9";

		$s9 = $pdo->prepare($para9);
		$s9->execute();	
		
		$row =  $s9->fetch();
			$p9 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p9</h5></td>";
			
$para10 = "SELECT ParaText FROM pickup WHERE ParaNum = 10";

		$s10 = $pdo->prepare($para10);
		$s10->execute();	
		
		$row =  $s10->fetch();
			$p10 = $row['ParaText'];		
					
		echo "<td><h5>$p10</h5></td></tr>";



			
$para11 = "SELECT ParaText FROM pickup WHERE ParaNum = 11";

		$s11 = $pdo->prepare($para11);
		$s11->execute();	
		
		$row =  $s11->fetch();
			$p11 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p11</h5></td>";
			
$para12 = "SELECT ParaText FROM pickup WHERE ParaNum = 12";

		$s12 = $pdo->prepare($para12);
		$s12->execute();	
		
		$row =  $s12->fetch();
			$p12 = $row['ParaText'];		
					
		echo "<td><h5>$p12</h5></td></tr>";




			
$para13 = "SELECT ParaText FROM pickup WHERE ParaNum = 13"; 
		
		$s13 = $pdo->prepare($para13);
		$s13->execute();	
		
		$row =  $s13->fetch();
			$p13 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p13</h5></td>";
			
			
$para14 = "SELECT ParaText FROM pickup WHERE ParaNum = 14";

		$s14 = $pdo->prepare($para14);
		$s14->execute();	
		
		$row =  $s14->fetch();
			$p14 = $row['ParaText'];		
					
		echo "<td><h5>$p14</h5></td></tr>";




		
$para15 = "SELECT ParaText FROM pickup WHERE ParaNum = 15";

		$s15 = $pdo->prepare($para15);
		$s15->execute();	
		
		$row =  $s15->fetch();
			$p15 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p15</h5></td>";


			
$para16 = "SELECT ParaText FROM pickup WHERE ParaNum = 16";

		$s16 = $pdo->prepare($para16);
		$s16->execute();	
		
		$row =  $s16->fetch();
			$p16 = $row['ParaText'];		
					
		echo "<td><h5>$p16</h5></td></tr>";




		
$para17 = "SELECT ParaText FROM pickup WHERE ParaNum = 17";

		$s17 = $pdo->prepare($para17);
		$s17->execute();	
		
		$row =  $s17->fetch();
			$p17 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p17</h5></td>";

			
$para18 = "SELECT ParaText FROM pickup WHERE ParaNum = 18";

		$s18 = $pdo->prepare($para18);
		$s18->execute();	
		
		$row =  $s18->fetch();
			$p18 = $row['ParaText'];		
					
		echo "<td><h5>$p18</h5></td></tr>";



			
$para19 = "SELECT ParaText FROM pickup WHERE ParaNum = 19";

		$s19 = $pdo->prepare($para19);
		$s19->execute();	
		
		$row =  $s19->fetch();
			$p19 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p19</h5></td>";
			
$para20 = "SELECT ParaText FROM pickup WHERE ParaNum = 20";

		$s20 = $pdo->prepare($para20);
		$s20->execute();	
		
		$row =  $s20->fetch();
			$p20 = $row['ParaText'];		
					
		echo "<td><h5>$p20</h5></td></tr>";



			
$para21 = "SELECT ParaText FROM pickup WHERE ParaNum = 21";

		$s21 = $pdo->prepare($para21);
		$s21->execute();	
		
		$row =  $s21->fetch();
			$p21 = $row['ParaText'];		
					
		echo "<tr><td><h5>$p21</h5></td>";
			
$para22 = "SELECT ParaText FROM pickup WHERE ParaNum = 22";

		$s22 = $pdo->prepare($para22);
		$s22->execute();	
		
		$row =  $s22->fetch();
			$p22 = $row['ParaText'];		
					
		echo "<td><h5>$p22</h5></td></tr>";

?>
</table></div>


<?php			
$para23 = "SELECT ParaText FROM pickup WHERE ParaNum = 23";

		$s23 = $pdo->prepare($para23);
		$s23->execute();	
		
		$row =  $s23->fetch();
			$p23 = $row['ParaText'];		
					
		echo "<h3>$p23</h3>";
			
			
?>
<br><br>      	
 </blockquote>
 </div>

<!----------------------  MAIN CONTENT ENDS ----------------------------->

	<div class="clearFloat"></div>
	<div id="footer">Admin Management Panel</div>
	<div class="clearFloat"></div>
</div>
</body>
</html>