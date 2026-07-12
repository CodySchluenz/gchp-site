<?php
/*
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


*/

		include "../../includes/databasesetup.php";
		
		
// click edit button
if (isset($_POST['action']) and $_POST['action'] == "Edit")
{
	$sbID = $_POST['sbID'];
		try {
			$sql = 'select *  FROM bar WHERE sbID = :sbID';
			$s = $pdo->prepare($sql);
			$s->bindValue(':sbID', $_POST['sbID']);
			$s->execute();
		}
		catch (PDOException $e)
		{
			  $error = 'Error fetching bar: ' . $e->getMessage();
			  include 'error.html.php';
			  exit();
		}

		$row = $s->fetch();

		$sbID = $row['sbID'];
		$title = $row['title'];
		$subtitle= $row['subtitle'];
		$para = $row['para'];
	
	


	include 'edit.html.php';
	exit();

}

///////////////////////////////////////////
///         CLICKING EDIT BUTTON SENDS TO EDIT FORM           ///
///////////////////////////////////////////
//EDIT form
if (isset($_GET['edit']))
{



	try 
	{

		$sql = 'UPDATE bar SET
		title = :title,
		subtitle = :subtitle,
		para = :para
		WHERE sbID = :sbID';

		$s = $pdo->prepare($sql);
		
		$s->bindValue(':title', $_POST['txtTitle2']);
		$s->bindValue(':subtitle', $_POST['txtSubtitle']);
		$s->bindValue(':para', $_POST['txtPara']);
		$s->bindValue(':sbID', $_POST['sbID']);
		$s->execute();
}
catch (PDOException $e)
{
  $error = 'Error fetching data: ' . $e->getMessage();
  echo $error;
  exit();
}

}
/*
while ($row = $result->fetch())
{
  $bars[] = array ('sbID'=>$row['sbID'],
					'title'=>$row['txtTitle'],
					'subtitle'=>$row['txtSubtitle'],
					'para'=>$row['txtPara']);			

}
}*/	
//////////////////////////////////////////////////////////
///      SUBMITTING NEW INFO TO THE SIDEBAR TABLE      ///
/////////////////////////////////////////////////////////

if (isset($_GET['add']))
{
  include 'add.html.php';
  exit();
}


if (isset($_POST['txtTitle']))
{
  try
  {
 
 
    $sql = 'INSERT INTO bar SET
        sbID = :sbID,
		title = :title,
		subtitle = :subtitle,
		para = :para';
    $s = $pdo->prepare($sql);
    $s->bindValue(':sbID', $_POST['sbID']);
	$s->bindValue(':title', $_POST['txtTitle']);
	$s->bindValue(':subtitle', $_POST['txtSubtitle']);
	$s->bindValue(':para', $_POST['txtPara']);

    $s->execute();
  }
catch (PDOException $e)
{
  $error = 'Error fetching applicants: ' . $e->getMessage();
  echo $error;
  exit();
}
}




//<<<<<<<<<<<<<<<<  DELETE >>>>>>>>>>>>>>>>>>>>>>>>//

///     DELETE SIDEBAR RECORDS         ///



if (isset($_POST['action']) and $_POST['action'] == "Delete")
{
	  try
	  {
	    $sql = 'DELETE FROM bar WHERE sbID = :sbID';
	    $s = $pdo->prepare($sql);
	    $s->bindValue(':sbID', $_POST['sbID']);
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
  $sql = 'SELECT * FROM bar';
  $result = $pdo->query($sql);
}
catch (PDOException $e)
{
  $error = 'Error fetching applicants: ' . $e->getMessage();
  echo $error;
  exit();
}

while ($row = $result->fetch())
{
  $bars[] = array ('sbID'=>$row['sbID'],
					'title'=>$row['title'],
					'subtitle'=>$row['subtitle'],
					'para'=>$row['para']);			

}
/*///////////////////////////////////////////
>>>>>>>>      VIEW THE DATA        <<<<<<<<<<
///////////////////////////////////////////*/
include 'sidebar.html.php';