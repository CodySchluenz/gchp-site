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


?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	
	<title>GCHP Management Panel</title>
	<link rel="stylesheet" type="text/css" href="donor.css" media="all" />
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
<br><br><br><br><br><br><br>	
<!-----------------------    MENU BAR    ---------------------->
<div class="adminmenu">

	<a href="../index.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME</a>	
	<a href="../donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
	<a href="../applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
	<a href="../sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
	<a href="../pickup/index.php"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>

	<a href="?logout" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
</div>
	<div id="maincontent">


<blockquote><h5>:: >> Manage Donators </h5></blockquote>
<blockquote><br>
<h1>Edit Donor Form</h1>


<div class="editSBTable">

<table width="175px" >
<form  action="?edit" method="POST" name="updateForm">

	  
	  	<tr><td>Full Name<br>
		<input class="inputForm" type="text" name="txtdonName2" value="<?php echo $donName ?>"></td></tr>
	  	
	  	
	    	<tr><td>Contact<br>
		<input class="inputForm" type="text" name="txtdonContact" value="<?php echo $donContact ?>"></td></tr>
	   
	    	
	   	<tr><td>Address<br>
		<input class="inputForm" type="text" name="txtaddress" value="<?php echo $address ?>"></td></tr>
		
		<tr><td>City<br>
		<input class="inputForm" type="text" name="txtcity" value="<?php echo $city ?>"></td></tr>
	    	
	    	<tr><td>State<br>
		<input class="inputForm" type="text" name="txtstate" value="<?php echo $state ?>"></td></tr>
	    	
	    	
	   	<tr><td>Zip<br>
		<input class="inputForm" type="text" name="txtzip" value="<?php echo $zip ?>"></td></tr>
		
		<tr><td>Phone<br>
		<input class="inputForm" type="text" name="txtphone" value="<?php echo $phone ?>"></td></tr>
	   	
	   	<tr><td>Email <br>
		<input class="inputForm" type="text" name="txtemail" value="<?php echo $email ?>"></td></tr>
	   	
	   	
	<tr><input type ="hidden" name='donID' value="<?php echo $donID ?>"><br>
	<th><br><input class="btn-style" type="submit" value="Submit"></th></tr>
</form>

</table>
</blockquote>
</div>

<!----------------------  MAIN CONTENT ENDS ----------------------------->

	<div class="clearFloat"></div>
	<div id="footer">Admin Management Panel</div>
	<div class="clearFloat"></div>
</div>
</body>
</html>


<!--  STERLINGS OLD CODE


<tr>

 </tr>
<tr>
   <th>State</th>
	    <th>Zip Code</th>
	    <th>Phone</th>
		<th></th>
	 </tr>
	 <tr><td>
<select name = "txtstate" maxlength = '4'  value="<?php echo $state ?>" />
	<option value="AL">Alabama</option>
	<option value="AK">Alaska</option>
	<option value="AZ">Arizona</option>
	<option value="AR">Arkansas</option>
	<option value="CA">California</option>
	<option value="CO">Colorado</option>
	<option value="CT">Connecticut</option>
	<option value="DE">Delaware</option>
	<option value="DC">District Of Columbia</option>
	<option value="FL">Florida</option>
	<option value="GA">Georgia</option>
	<option value="HI">Hawaii</option>
	<option value="ID">Idaho</option>
	<option value="IL">Illinois</option>
	<option value="IN">Indiana</option>
	<option value="IA">Iowa</option>
	<option value="KS">Kansas</option>
	<option value="KY">Kentucky</option>
	<option value="LA">Louisiana</option>
	<option value="ME">Maine</option>
	<option value="MD">Maryland</option>
	<option value="MA">Massachusetts</option>
	<option value="MI">Michigan</option>
	<option value="MN">Minnesota</option>
	<option value="MS">Mississippi</option>
	<option value="MO">Missouri</option>
	<option value="MT">Montana</option>
	<option value="NE">Nebraska</option>
	<option value="NV">Nevada</option>
	<option value="NH">New Hampshire</option>
	<option value="NJ">New Jersey</option>
	<option value="NM">New Mexico</option>
	<option value="NY">New York</option>
	<option value="NC">North Carolina</option>
	<option value="ND">North Dakota</option>
	<option value="OH">Ohio</option>
	<option value="OK">Oklahoma</option>
	<option value="OR">Oregon</option>
	<option value="PA">Pennsylvania</option>
	<option value="RI">Rhode Island</option>
	<option value="SC">South Carolina</option>
	<option value="SD">South Dakota</option>
	<option value="TN">Tennessee</option>
	<option value="TX">Texas</option>
	<option value="UT">Utah</option>
	<option value="VT">Vermont</option>
	<option value="VA">Virginia</option>
	<option value="WA">Washington</option>
	<option value="WV">West Virginia</option>
	<option value="WI">Wisconsin</option>
	<option value="WY">Wyoming</option>
</select>		</td>
</P>
<input type="submit" value="Edit"  /> -->