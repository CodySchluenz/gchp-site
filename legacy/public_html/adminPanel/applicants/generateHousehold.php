<?PHP
//               tests for valid login    needs to be on every page
if (!isset($_SESSION))
{
session_start(); 
}
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}

try
{
	$sql = 'select * from cities where cityID = :cityID';
	$s = $pdo->prepare($sql);
	$s->bindValue(':cityID', $_POST['citySEL']);
	$s->execute();
}
catch (PDOException $e)
{
  $error = 'Error fetching City Name: ' . $e->getMessage();
  echo $error;
  exit();
}

header("Content-Type: application/vnd.ms-word"); 
		header("Expires: 0"); 
		header("Cache-Control: must-revalidate, post-check=0, pre-check=0"); 
		header("content-disposition: attachment;filename=app_Members.doc");
		
		$city = $s->fetch();
		$appID = $_POST['appID'];
		
		

		if($_POST['treeCHK'] =="on")
			$tree = "YES";
		else
			$tree = "NO";
	
		if($_POST['diabeticCHK'] =="on")
			$diabetic = "YES";
		else
			$diabetic = "NO";
		
			if($_POST['bedType'] == null)
				$bedType = " ";
			if($_POST['bedSize'] == null)
				$bedSize = " ";
			
		
		$numRows = $_POST['children'];
		?>
			<html><head><style type='text\css'>table th, td {font-size:14px;}</style></head><body style='font-size:13px'>
			<strong>PU#:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;#Bags:<br /><br />
			&nbsp;&nbsp;&nbsp;Name:</strong> <?php echo $_POST['fNameTXT'] . " " . $_POST['lNameTXT']?>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
			<strong>Phone Number:<?php echo $_POST['phoneTXT']?></strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>#In Household:&nbsp;&nbsp;</strong><?php echo $_POST['children']?><br /><br />
			<table><tr><td valign='top'><strong>Address:</strong></td><td><?php echo $_POST['addressTXT']?><br /><?php echo $city['cityName']?>, WI <?php echo $city['cityZip']?><br /></td></tr></table>
		
			<table style="width: 75%;"><tr><th align='left'>Name</th>
					   <th align='left'>Sex&nbsp;&nbsp;&nbsp;</th>
					   <th align='left'>age&nbsp;&nbsp;&nbsp;</th>
					   <th align='left'>Clothing Sizes</th></tr>
		
		<?php
		for($numMem = 0; $numMem < $_POST['children']; $numMem++){

			
			?>
				<tr><td valign='top'><?php echo $_POST['nameTXT' .$numMem]?></td>
					  <td valign='top'><?php echo $_POST['sexRAD' .$numMem]?></td>
					  <td valign='top'><?php echo $_POST['ageSEL' .$numMem]?></td>
					  <td>Pants: <?php echo $_POST['sizeTXT1' .$numMem]?><br />
						  Shirt: <?php echo $_POST['sizeTXT2' .$numMem]?><br />
						  Underwear: <?php echo $_POST['sizeTXT3' .$numMem]?><br />
						  Sock: <?php echo $_POST['sizeTXT4' .$numMem]?><br />
						  Diaper: <?php echo $_POST['sizeTXT5' .$numMem]?><br /></tr>
				<tr><td colspan="4"><strong>Gifts:&nbsp;&nbsp;</strong>&nbsp;&nbsp;<?php echo $_POST['giftsTXT' .$numMem]?>
				<tr><td colspan="4"><hr /></td></tr>
		<?php
		}
		?>
			</table>
			Bed Type:&nbsp;&nbsp;<?php echo $_POST['bedCHK']?>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Bed Size:&nbsp;&nbsp;<?php echo $_POST['bedSEL']?>
			&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Permission to adopt:&nbsp;&nbsp;<?php echo $tree?>
			&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Diabetic:&nbsp;&nbsp;<?php echo $diabetic?>
			</body></html>