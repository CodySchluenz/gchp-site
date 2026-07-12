<!DOCTYPE html>
<html>
<head>

	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="description" content="The Grant County Holiday Project helps people in need or crisis with basic necessities during the Holiday season. Donations and volunteers are always welcome to assist needy families around the holidays. Money, material goods, time and talent are all appreciated for this worthy cause.">
        
	<title>Grant County Holiday Project helping people in need during the Holiday season</title>
	 <link rel="stylesheet" type="text/css" href="index.css" media="all" /> 

	<!--[if IE]>
	<style type="text/css" media="all">.borderitem {border-style: solid;}</style>
	<![endif]-->
			<style type="text/css">
	body {
	background-color: #04240A;  
}


    </style>
</head>

<body>

<div id="main">
<div class="clearFloat"></div>
<div id="header"></div>	
<div class="clearFloat">
<!--///////////////////    MENU BAR BUTTONS  ////////////////////////-->

			<a href="index.php" class="btn_Home">Home</a>
			<a href="donate.php" class="btn_Donate">Donate</a>
			<a href="application/application.php" class="btn_App">Application</a>
			<a href="contactUs.php" class="btn_ContactUs">Contact Us</a><p class="btn_right">&nbsp;</p>
</div>
<div id="maincontent">
				
	<BR/><BR/>
	 <blockquote><BR/>
<h1 "font-size=12px;">Welcome to the Grant County Holiday Project</h1>
        <p>The mission of the Grant County Holiday Project is to seek out and provide food, clothing, gifts or toys to children and elderly who otherwise might not receive any presents
         or have food for the holiday table.</p>
		<p>Thirty plus years ago, the Grant County Holiday Project began by giving out donated used items and donated food products. 
		Today with the help of our generous donors and the Tri-state Toys for Tots program out of Dubuque Iowa, we are able to provide new clothing and toys for families 
		having financial difficulties due to unforeseen circumstances.</p>
		<p> The Grant County Holiday Project is run solely by volunteers and funded by donations from generous organizations, 
		businesses and individuals. We serve over 400 Grant County families each season.</p>
        <p>You may mail your check or money order to:</p>
		<p><strong>Grant County Holiday Project<br />
		   235 W. Elm St.<br />
		   Lancaster WI 53813</strong></p><br>
        <h2>Additional Information</h2>
       
<p>We can begin to take donated gift and clothing items on <b>October 1</b> of each program year. This year, instead of food, we prefer cash donations in order to purchase food gift cards/certificates. Due to the move to our new space, we will no longer have the space to distribute the food commodities. Food gift/certificates will allow families to buy what they wish for Christmas. Thus no waste or heavy lifting. Any questions please call 608-723-2136 ext 1194 or email at skleinow@co.grant.wi.gov and leave a message with name and phone number. This a message only phone. <br><br><b>Donation Items can be left at two Allegiant Oil sites.</b>  <br>They are: <h3> 190 N 2nd St, Platteville, WI.  Monday-Friday Hours: 6:00AM - 6:00 PM <br>and also at 1486 Industrial Park Rd, Lancaster, WI.  Monday-Friday 7:00 AM-5:00PM. </p> </h3>
 <p>Cash donations: Make checks payable to Grant County Holiday Project send to <br>245 W. Elm St. Lancaster WI. 53813

        
       
        </p></blockquote>
</div>
		
<!----------------------     SIDEBAR CONTENT GOES HERE  ----------------------------->
<div STYLE="background-color:#FFFFFF;" id="sidebar"><br><br><br>

<div id="news">Latest News</div><br>
<div id="sbTable">
<?php


include "includes/dbConnect.php";


try
{
	$sql = 'SELECT * from bar';
	$result = $pdo->query($sql);
	while ($row = $result->fetch())
	{
	 $bars[] = array ('sbID'=>$row['sbID'],
	 
		'title'=>$row['title'],
		'subtitle'=>$row['subtitle'],
		'para'=>$row['para'] );
				

	}
}
catch (PDOException $e)
{
	  $error = 'Error fetching DATA!!! ' . $e->getMessage();
	  include 'OOPS!!!Error.html.php';
	  exit();
}



	foreach ($bars as $bar): ?>

	<tr>
	<div id="title"><td><?php echo $bar['title']?></td></div><br>

	<div id="subtitle"><td><?php echo $bar['subtitle']?></td></div>
	
	<div id="para"><td><?php echo $bar['para']?></td></div><br>
</tr>

<?php endforeach;?>
        <h5>Useful Links</h5>
        <a href="pickUp.php" target="_blank">Pickup Schedule</a> <br>
<a href="PDFapplication.pdf" target="_blank">PDF Application </a><br>
<a href="http://grantcounty.org/" target="_blank">Grant County Website</a><br><br>

<img src="imgs/tft.gif" alt="Toys For Tots" /><br>Toys donated by Toys for Tots <br>Dubuque, IA.<br>
 </div>     
</div>
	<div class="clearFloat"></div>
<div id="footer"></a> Website Designed by the Southwest Tech 2014 Web Programming Students  | <a href="adminPanel/">Administration</a></div><br><br>
	<div class="clearFloat"></div>
</div>
</body>
</html>