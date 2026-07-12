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



include_once "../../includes/databasesetup.php";



// click edit button
if (isset($_POST['action']) and $_POST['action'] == "Edit")
{
	$donID = $_POST['donID'];
		try {
			$sql = 'select *  FROM donor WHERE donID = :donID';
			$s = $pdo->prepare($sql);
			$s->bindValue(':donID', $_POST['donID']);
			$s->execute();
		}
		catch (PDOException $e)
		{
			  $error = 'Error fetching donor data: ' . $e->getMessage();
			  include 'error.html.php';
			  exit();
		}

		$row = $s->fetch();
		
			$donID = $row['donID'];
			$donName = $row['donName'];
			$donContact = $row['donContact'];
			
			$address = $row['address'];
			$city = $row['city'];
			$state = $row['state'];
			
			$zip = $row['zip'];
			$phone = $row['phone'];
			$email = $row['email'];
			
	include 'editDonor.html.php';
	exit();

}


/// execute update form info
if ( isset($_GET['edit']))
{
	try {

		$sql = 'UPDATE donor SET
		donName = :donName,
		donContact = :donContact,
		address = :address,
		city = :city,
		state = :state,
		zip = :zip,
		phone = :phone,
		email = :email
		WHERE donID = :donID';

		$s = $pdo->prepare($sql);
		
	
		$s->bindValue(':donName', $_POST['txtdonName2']);
		$s->bindValue(':donContact', $_POST['txtdonContact']);
		$s->bindValue(':address', $_POST['txtaddress']);
		$s->bindValue(':city', $_POST['txtcity']);
		$s->bindValue(':state', $_POST['txtstate']);
		$s->bindValue(':zip', $_POST['txtzip']);
		$s->bindValue(':phone', $_POST['txtphone']);
		$s->bindValue(':email', $_POST['txtemail']);		
		$s->bindValue(':donID', $_POST['donID']);
		$s->execute();

}
catch (PDOException $e)
{
  $error = 'Error fetching data: ' . $e->getMessage();
  echo $error;
  exit();
}

}

//////////////////////////////////////////////////////////////////////////////

// SELECTION BY NAME
if (isset($_POST['listName']))
{
	
	$name = $_POST['listName'];
	
	if( $name == "ALL") 
	{
	
	try
{
  $sql = 'SELECT * FROM donor';
  $result = $pdo->query($sql);
}
catch (PDOException $e)
{
  $error = 'Error fetching donors ' . $e->getMessage();
  echo $error;
  exit();
}

while ($row = $result->fetch())
{
  $donors[] = array ('donID'=>$row['donID'],
					'donName'=>$row['donName'],
					'donContact'=>$row['donContact'],
					'address'=>$row['address'],
					'city'=>$row['city'],
					'state'=>$row['state'],
					'zip'=>$row['zip'],
					'phone'=>$row['phone'], 
					'email'=>$row['email']);

}

include 'donortableSearchAll.html.php';
	exit();
	
	
	}
	
else{
	
	try
	{

		$sql = "SELECT * from donor where donName = :name";
		$s = $pdo->prepare($sql);
		$s->bindValue(':name',  $_POST['listName']);
		$s->execute();
	
		
		
	}
	catch (PDOException $e)
	{
	  $error = 'Error fetching Donors by Name ' . $e->getMessage();
	  include '../../includes/error.php';
	  exit();
	}
	

 $row = $s->fetch();
	
$donors[] = array ('donID'=>$row['donID'],
					'donName'=>$row['donName'],
					'donContact'=>$row['donContact'],
					'address'=>$row['address'],
					'city'=>$row['city'],
					'state'=>$row['state'],
					'zip'=>$row['zip'],
					'phone'=>$row['phone'], 
					'email'=>$row['email']);

	

include 'donortableSearch.html.php';

exit();
}}


/////////////////////////////////////////////////////////////////////////////////



//  add donor to the database
if (isset($_GET['add']))
{
  include 'newDonorform.html.php';
  exit();

}

if (isset($_POST['txtdonName']))
{
	  try
  {

	    $sql = 'INSERT INTO donor SET
			donID = :donID,

			donName = :donName,
			donContact = :donContact,
			address = :address,
			city  = :city,
			state = :state,
			zip  = :zip,
			phone  = :phone,
			email = :email';
		
		
		    $s = $pdo->prepare($sql);
		    
    $s->bindValue(':donID', $_POST['donID']);
	$s->bindValue(':donName', $_POST['txtdonName']);
	$s->bindValue(':donContact', $_POST['txtdonContact']);
	$s->bindValue(':address', $_POST['txtaddress']);
	$s->bindValue(':city', $_POST['txtcity']);
	$s->bindValue(':state', $_POST['txtstate']);
	$s->bindValue(':zip', $_POST['txtzip']);
	$s->bindValue(':phone', $_POST['txtphone']);
	$s->bindValue(':email', $_POST['txtemail']);

   	 $s->execute();
		
  }
catch (PDOException $e)
{
  $error = 'Error fetching donor data: ' . $e->getMessage();
  echo $error;
  exit();
}
}


//DELETE donors

if (isset($_POST['action']) and $_POST['action'] == "Delete")
{
	  try
	  {
	    $sql = 'DELETE FROM donor WHERE donID = :donID';
	    $s = $pdo->prepare($sql);
	    $s->bindValue(':donID', $_POST['donID']);
	    $s->execute();
	  }
	catch (PDOException $e)
	{
	  $error = 'Error fetching data: ' . $e->getMessage();
	  echo $error;
	  exit();
	}

}


try
{
  $sql = 'SELECT * FROM donor';
  $result = $pdo->query($sql);
}
catch (PDOException $e)
{
  $error = 'Error fetching donors ' . $e->getMessage();
  echo $error;
  exit();
}

while ($row = $result->fetch())
{
  $donors[] = array ('donID'=>$row['donID'],
					'donName'=>$row['donName'],
					'donContact'=>$row['donContact'],
					'address'=>$row['address'],
					'city'=>$row['city'],
					'state'=>$row['state'],
					'zip'=>$row['zip'],
					'phone'=>$row['phone'], 
					'email'=>$row['email']);

}



include 'donortable.html.php';