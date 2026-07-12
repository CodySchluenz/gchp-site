<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>

	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="description" content="The Grant County Holiday Project helps people in need or crisis with basic necessities during the Holiday season. Donations and volunteers are always welcome to assist needy families around the holidays. Money, material goods, time and talent are all appreciated for this worthy cause.">
	<link rel="stylesheet" type="text/css" href="index.css" media="all" />
	<!--[if IE]>
	<style type="text/css" media="all">.borderitem {border-style: solid;}</style>
	<![endif]-->
		<style type="text/css">
	body {
	background-color: #003300;  
}
h1, h2, h3, h4 {
 
	text-align: center;
	font-size: 14px;
	font-weight: bold;
}
 h5, h6 {
	font-family: Segoe, "Segoe UI", "DejaVu Sans", "Trebuchet MS", Verdana, sans-serif;
	font-weight: normal;
	text-align: left;
		font-size: 13px;
}
p {
	font-family: Segoe, "Segoe UI", "DejaVu Sans", "Trebuchet MS", Verdana, sans-serif;
	margin-bottom: 1.1em;
	margin-top: 0;
}

    </style>
</head>

<body>

<div id="main">
<div class="clearFloat"></div>
<div id="header" >Grant County Holiday Project</div>	
<div class="clearFloat">
<!--///////////////////    MENU BAR BUTTONS  ////////////////////////-->
	<a href="index.php" class="btn_Home">Home</a>
			<a href="donate.php" class="btn_Donate">Donate</a>
			<a href="application/application.php" class="btn_App">Application</a>
			<a href="contactUs.php" class="btn_ContactUs">Contact Us</a>
			<p class="btn_right">&nbsp;</p>
			</div>

<!----------------------  MAIN CONTENT TEXT AND CODE GO HERE ----------------------------->

<div id="widecontent">
<!----------------------  MAIN CONTENT TEXT AND CODE GO HERE ----------------------------->
<br><br><br>
<blockquote>
<?php

include "includes/databasesetup.php";

$para1 = "SELECT ParaText FROM pickup WHERE ParaNum = 1"; 
		
		$s1 = $pdo->prepare($para1);
		$s1->execute();	
		
		$row =  $s1->fetch();
			$p1 = $row['ParaText'];		
					
		echo "<h1>$p1</h1>";
			
			

		
		
?>
<div class="panelTable">
<table>
		

<?php

$para2 = "SELECT ParaText FROM pickup WHERE ParaNum = 2";

		$s2 = $pdo->prepare($para2);
		$s2->execute();	
		
		$row =  $s2->fetch();
			$p2 = $row['ParaText'];		
					
		echo "<tr><td colspan='2'><h5 style='text-align: left;'>$p2</h5></td></tr>";


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



<!----------------------   FOOTER CONENT     --------------------------->
<div id="footer"><a href="http://grantcounty.org/" target="_blank">Official Grant Co. Website</a> | Website Designed by the Southwest Tech 2014 Web Programming Students  | <a href="adminPanel/">Admin</a></div><br><br>

<!--------------------  END FOOTER CONTENT   --------------------------->



</div>
</body>
</html>